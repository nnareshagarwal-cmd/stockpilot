import asyncio
import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.common.security import hash_password
from app.modules.auth.models import Business, User, Role, Permission, RolePermission, BusinessUser
from app.modules.settings.models import (
    Category,
    Brand,
    UnitOfMeasure,
    Location,
    StockCondition,
    TaxRate,
    AttributeDefinition,
    AttributeOption,
)
from app.modules.catalogue.models import (
    Product,
    ProductVariant,
    ProductAttributeValue,
    PriceHistory,
)

DEFAULT_ROLES = [
    {"name": "admin", "display_name": "Administrator", "description": "Full access to shop settings, products, users, and operations", "is_system": True},
    {"name": "staff", "display_name": "Staff", "description": "Operational access to products, stock, and sales", "is_system": True},
]

DEFAULT_PERMISSIONS = [
    {"code": "products.view", "display_name": "View Products", "module": "products"},
    {"code": "products.create", "display_name": "Create Products", "module": "products"},
    {"code": "products.edit", "display_name": "Edit Products", "module": "products"},
    {"code": "products.delete", "display_name": "Archive Products", "module": "products"},
    {"code": "products.import", "display_name": "Import Products", "module": "products"},
    {"code": "stock.view", "display_name": "View Stock", "module": "stock"},
    {"code": "stock.adjust", "display_name": "Adjust Stock", "module": "stock"},
    {"code": "stock.transfer", "display_name": "Transfer Stock", "module": "stock"},
    {"code": "stock.count", "display_name": "Stock Count", "module": "stock"},
    {"code": "purchasing.view", "display_name": "View Purchases", "module": "purchasing"},
    {"code": "purchasing.create", "display_name": "Create Purchase Orders", "module": "purchasing"},
    {"code": "purchasing.receive", "display_name": "Receive Goods", "module": "purchasing"},
    {"code": "purchasing.approve", "display_name": "Approve Purchase Orders", "module": "purchasing"},
    {"code": "sales.view", "display_name": "View Sales", "module": "sales"},
    {"code": "sales.create_invoice", "display_name": "Create Invoices", "module": "sales"},
    {"code": "sales.post_invoice", "display_name": "Post Invoices", "module": "sales"},
    {"code": "sales.discount", "display_name": "Apply Discounts", "module": "sales"},
    {"code": "sales.price_override", "display_name": "Override Prices", "module": "sales"},
    {"code": "sales.refund", "display_name": "Process Refunds", "module": "sales"},
    {"code": "reports.view", "display_name": "View Reports", "module": "reports"},
    {"code": "reports.export", "display_name": "Export Reports", "module": "reports"},
    {"code": "settings.view", "display_name": "View Settings", "module": "settings"},
    {"code": "settings.edit", "display_name": "Edit Settings", "module": "settings"},
    {"code": "settings.users", "display_name": "Manage Users", "module": "settings"},
]


async def seed_demo_data(db: AsyncSession):
    # Check if demo business already exists
    b_res = await db.execute(select(Business).where(Business.name == "Demo Retailer"))
    if b_res.scalar_one_or_none():
        print("Demo data already seeded, skipping.")
        return

    print("Seeding demo data...")

    # 1. Roles & Permissions
    roles = {}
    for r_data in DEFAULT_ROLES:
        r_res = await db.execute(select(Role).where(Role.name == r_data["name"]))
        existing_r = r_res.scalar_one_or_none()
        if not existing_r:
            role = Role(**r_data)
            db.add(role)
            await db.flush()
            roles[r_data["name"]] = role
        else:
            roles[r_data["name"]] = existing_r

    perms = []
    for p_data in DEFAULT_PERMISSIONS:
        p_res = await db.execute(select(Permission).where(Permission.code == p_data["code"]))
        existing_p = p_res.scalar_one_or_none()
        if not existing_p:
            perm = Permission(**p_data)
            db.add(perm)
            perms.append(perm)
        else:
            perms.append(existing_p)
    await db.flush()

    for p in perms:
        rp_res = await db.execute(
            select(RolePermission).where(
                RolePermission.role_id == roles["admin"].id,
                RolePermission.permission_id == p.id,
            )
        )
        if not rp_res.scalar_one_or_none():
            db.add(RolePermission(role_id=roles["admin"].id, permission_id=p.id))

    # 2. Demo Business
    business = Business(
        name="Demo Retailer",
        legal_name="Demo Retailer Pvt Ltd",
        gstin="29ABCDE1234F1Z5",
        phone="9876543210",
        email="demo@stockpilot.com",
        city="Bangalore",
        state="Karnataka",
        country="India",
        currency="INR",
        timezone="Asia/Kolkata",
    )
    db.add(business)
    await db.flush()
    tenant_id = business.id

    # 3. Demo Admin User
    user = User(
        email="demo@stockpilot.com",
        password_hash=hash_password("DemoPass123"),
        full_name="Demo Admin",
        phone="9876543210",
    )
    db.add(user)
    await db.flush()

    db.add(BusinessUser(
        business_id=tenant_id,
        user_id=user.id,
        role_id=roles["admin"].id,
        is_active=True,
    ))

    # 4. Units of measure
    unit_defs = [
        {"code": "PC", "name": "Piece", "decimal_places": 0},
        {"code": "BOX", "name": "Box", "decimal_places": 0},
        {"code": "PKT", "name": "Packet", "decimal_places": 0},
        {"code": "MTR", "name": "Meter", "decimal_places": 2},
        {"code": "SQFT", "name": "Square Foot", "decimal_places": 2},
        {"code": "KG", "name": "Kilogram", "decimal_places": 3},
        {"code": "LTR", "name": "Litre", "decimal_places": 3},
        {"code": "SET", "name": "Set", "decimal_places": 0},
        {"code": "ROLL", "name": "Roll", "decimal_places": 0},
    ]
    units = {}
    for u in unit_defs:
        obj = UnitOfMeasure(tenant_id=tenant_id, **u)
        db.add(obj)
        units[u["code"]] = obj
    await db.flush()

    # 5. Stock conditions
    stock_conds = [
        {"name": "New / Sellable", "code": "new_sellable", "is_sellable": True, "sort_order": 1},
        {"name": "Good / Sellable", "code": "good_sellable", "is_sellable": True, "sort_order": 2},
        {"name": "Open Box / Display", "code": "open_box_display", "is_sellable": True, "sort_order": 3},
        {"name": "Damaged", "code": "damaged", "is_sellable": False, "sort_order": 4},
        {"name": "Under Inspection", "code": "under_inspection", "is_sellable": False, "sort_order": 5},
        {"name": "Returned Pending", "code": "returned_pending", "is_sellable": False, "sort_order": 6},
        {"name": "Written Off", "code": "written_off", "is_sellable": False, "sort_order": 7},
    ]
    for sc in stock_conds:
        db.add(StockCondition(tenant_id=tenant_id, **sc))

    # 6. Tax rates
    tax_defs = [
        {"name": "GST 0%", "rate": Decimal("0.00"), "description": "Nil rate"},
        {"name": "GST 5%", "rate": Decimal("5.00"), "description": "5% rate"},
        {"name": "GST 12%", "rate": Decimal("12.00"), "description": "12% rate"},
        {"name": "GST 18%", "rate": Decimal("18.00"), "description": "18% rate"},
        {"name": "GST 28%", "rate": Decimal("28.00"), "description": "28% rate"},
        {"name": "Exempt", "rate": Decimal("0.00"), "description": "Exempted"},
    ]
    taxes = {}
    for td in tax_defs:
        obj = TaxRate(tenant_id=tenant_id, **td)
        db.add(obj)
        taxes[td["name"]] = obj
    await db.flush()

    # 7. Brands
    brand_names = ["HomeCraft", "Philips", "Havells", "Jaquar", "Asian Paints", "Godrej", "Stanley", "Fischer"]
    brands = {}
    for bn in brand_names:
        obj = Brand(tenant_id=tenant_id, name=bn)
        db.add(obj)
        brands[bn] = obj
    await db.flush()

    # 8. Hierarchical Categories
    cat_tree = {
        "Furniture": ["Sofas", "Tables", "Chairs", "Beds"],
        "Electrical": ["Lighting", "Switches & Sockets", "Wiring"],
        "Hardware": ["Fasteners", "Tools", "Adhesives"],
        "Sanitaryware": ["Basins", "Toilets", "Faucets"],
    }
    categories = {}
    for parent_name, children in cat_tree.items():
        parent_cat = Category(tenant_id=tenant_id, name=parent_name, sort_order=1)
        db.add(parent_cat)
        await db.flush()
        categories[parent_name] = parent_cat
        for child_name in children:
            child_cat = Category(tenant_id=tenant_id, name=child_name, parent_id=parent_cat.id, sort_order=2)
            db.add(child_cat)
            categories[child_name] = child_cat
    await db.flush()

    # 9. Locations
    main_store = Location(tenant_id=tenant_id, name="Main Store", code="STORE-01", location_type="store")
    db.add(main_store)
    godown_1 = Location(tenant_id=tenant_id, name="Godown 1", code="GDN-01", location_type="godown")
    db.add(godown_1)
    await db.flush()

    gf = Location(tenant_id=tenant_id, parent_id=main_store.id, name="Ground Floor", code="STORE-GF", location_type="floor")
    ff = Location(tenant_id=tenant_id, parent_id=main_store.id, name="First Floor", code="STORE-FF", location_type="floor")
    sec_a = Location(tenant_id=tenant_id, parent_id=godown_1.id, name="Section A", code="GDN-SEC-A", location_type="section")
    sec_b = Location(tenant_id=tenant_id, parent_id=godown_1.id, name="Section B", code="GDN-SEC-B", location_type="section")
    db.add_all([gf, ff, sec_a, sec_b])
    await db.flush()

    disp_a = Location(tenant_id=tenant_id, parent_id=gf.id, name="Display Area A", code="DISP-A", location_type="section")
    disp_b = Location(tenant_id=tenant_id, parent_id=gf.id, name="Display Area B", code="DISP-B", location_type="section")
    rack_1 = Location(tenant_id=tenant_id, parent_id=sec_a.id, name="Rack 1", code="RCK-01", location_type="rack")
    rack_2 = Location(tenant_id=tenant_id, parent_id=sec_a.id, name="Rack 2", code="RCK-02", location_type="rack")
    db.add_all([disp_a, disp_b, rack_1, rack_2])
    await db.flush()

    # 10. Attributes with Options
    # Furniture attributes
    furn_id = categories["Furniture"].id
    attr_width = AttributeDefinition(
        tenant_id=tenant_id, name="Width", code="width", data_type="decimal",
        category_id=furn_id, unit_label="cm", is_searchable=True, sort_order=1
    )
    attr_depth = AttributeDefinition(
        tenant_id=tenant_id, name="Depth", code="depth", data_type="decimal",
        category_id=furn_id, unit_label="cm", sort_order=2
    )
    attr_height = AttributeDefinition(
        tenant_id=tenant_id, name="Height", code="height", data_type="decimal",
        category_id=furn_id, unit_label="cm", sort_order=3
    )
    attr_frame = AttributeDefinition(
        tenant_id=tenant_id, name="Frame Material", code="frame_material", data_type="single_choice",
        category_id=furn_id, sort_order=4
    )
    attr_upholstery = AttributeDefinition(
        tenant_id=tenant_id, name="Upholstery", code="upholstery", data_type="text",
        category_id=furn_id, sort_order=5
    )
    attr_color = AttributeDefinition(
        tenant_id=tenant_id, name="Color", code="color", data_type="single_choice",
        category_id=furn_id, is_searchable=True, is_filterable=True, sort_order=6
    )
    attr_finish = AttributeDefinition(
        tenant_id=tenant_id, name="Finish", code="finish", data_type="single_choice",
        category_id=furn_id, is_searchable=True, sort_order=7
    )
    db.add_all([attr_width, attr_depth, attr_height, attr_frame, attr_upholstery, attr_color, attr_finish])
    await db.flush()

    # Options for Frame Material
    opt_sheesham = AttributeOption(attribute_id=attr_frame.id, value="Sheesham", sort_order=1)
    db.add_all([
        opt_sheesham,
        AttributeOption(attribute_id=attr_frame.id, value="Teak", sort_order=2),
        AttributeOption(attribute_id=attr_frame.id, value="Metal", sort_order=3),
    ])

    # Options for Color
    opt_grey = AttributeOption(attribute_id=attr_color.id, value="Grey", sort_order=1)
    db.add_all([
        opt_grey,
        AttributeOption(attribute_id=attr_color.id, value="Red", sort_order=2),
        AttributeOption(attribute_id=attr_color.id, value="Blue", sort_order=3),
        AttributeOption(attribute_id=attr_color.id, value="Walnut", sort_order=4),
        AttributeOption(attribute_id=attr_color.id, value="White", sort_order=5),
    ])

    # Options for Finish
    opt_matte = AttributeOption(attribute_id=attr_finish.id, value="Matte", sort_order=1)
    db.add_all([
        opt_matte,
        AttributeOption(attribute_id=attr_finish.id, value="Glossy", sort_order=2),
        AttributeOption(attribute_id=attr_finish.id, value="Natural", sort_order=3),
    ])
    await db.flush()

    # Electrical attributes
    elec_id = categories["Electrical"].id
    attr_wattage = AttributeDefinition(
        tenant_id=tenant_id, name="Wattage", code="wattage", data_type="decimal",
        category_id=elec_id, unit_label="W", is_searchable=True, sort_order=1
    )
    attr_voltage = AttributeDefinition(
        tenant_id=tenant_id, name="Voltage", code="voltage", data_type="decimal",
        category_id=elec_id, unit_label="V", sort_order=2
    )
    attr_color_temp = AttributeDefinition(
        tenant_id=tenant_id, name="Color Temperature", code="color_temperature", data_type="single_choice",
        category_id=elec_id, sort_order=3
    )
    db.add_all([attr_wattage, attr_voltage, attr_color_temp])
    await db.flush()

    opt_cool_white = AttributeOption(attribute_id=attr_color_temp.id, value="Cool White", sort_order=1)
    db.add_all([
        opt_cool_white,
        AttributeOption(attribute_id=attr_color_temp.id, value="Warm White", sort_order=2),
        AttributeOption(attribute_id=attr_color_temp.id, value="Daylight", sort_order=3),
    ])
    await db.flush()

    # Hardware attributes
    hw_id = categories["Hardware"].id
    attr_diameter = AttributeDefinition(
        tenant_id=tenant_id, name="Diameter", code="diameter", data_type="decimal",
        category_id=hw_id, unit_label="mm", is_searchable=True, sort_order=1
    )
    attr_length = AttributeDefinition(
        tenant_id=tenant_id, name="Length", code="length", data_type="decimal",
        category_id=hw_id, unit_label="mm", sort_order=2
    )
    attr_grade = AttributeDefinition(
        tenant_id=tenant_id, name="Grade", code="grade", data_type="text",
        category_id=hw_id, is_searchable=True, sort_order=3
    )
    db.add_all([attr_diameter, attr_length, attr_grade])
    await db.flush()

    # Sanitaryware attributes
    san_id = categories["Sanitaryware"].id
    attr_size = AttributeDefinition(
        tenant_id=tenant_id, name="Size/Width", code="size_width", data_type="decimal",
        category_id=san_id, unit_label="mm", is_searchable=True, sort_order=1
    )
    attr_san_mat = AttributeDefinition(
        tenant_id=tenant_id, name="Material", code="san_material", data_type="single_choice",
        category_id=san_id, sort_order=2
    )
    db.add_all([attr_size, attr_san_mat])
    await db.flush()

    opt_ceramic = AttributeOption(attribute_id=attr_san_mat.id, value="Ceramic", sort_order=1)
    db.add(opt_ceramic)
    await db.flush()

    # 11. Sample Products (4 items)
    # 1. Three-Seater Sofa
    sofa = Product(
        tenant_id=tenant_id,
        name="Three-Seater Sofa",
        description="Premium fabric sofa with wooden legs",
        category_id=categories["Sofas"].id,
        brand_id=brands["HomeCraft"].id,
        model="Comfort Plus 210",
        tax_rate_id=taxes["GST 18%"].id,
        created_by=user.id,
    )
    db.add(sofa)
    await db.flush()

    v_sofa = ProductVariant(
        tenant_id=tenant_id,
        product_id=sofa.id,
        sku="SOFA-3S-GRY-001",
        variant_name="Grey Fabric, 210cm, Walnut Legs",
        barcode="8901234567890",
        unit_id=units["PC"].id,
        purchase_price=Decimal("15000.00"),
        selling_price=Decimal("28000.00"),
        mrp=Decimal("32000.00"),
        reorder_point=Decimal("2"),
        reorder_quantity=Decimal("5"),
        created_by=user.id,
    )
    db.add(v_sofa)
    await db.flush()

    db.add_all([
        ProductAttributeValue(tenant_id=tenant_id, product_id=sofa.id, attribute_id=attr_width.id, decimal_value=Decimal("210.0")),
        ProductAttributeValue(tenant_id=tenant_id, product_id=sofa.id, attribute_id=attr_depth.id, decimal_value=Decimal("85.0")),
        ProductAttributeValue(tenant_id=tenant_id, product_id=sofa.id, attribute_id=attr_height.id, decimal_value=Decimal("78.0")),
        ProductAttributeValue(tenant_id=tenant_id, product_id=sofa.id, attribute_id=attr_frame.id, option_id=opt_sheesham.id),
        ProductAttributeValue(tenant_id=tenant_id, product_id=sofa.id, attribute_id=attr_upholstery.id, text_value="Premium cotton fabric"),
        ProductAttributeValue(tenant_id=tenant_id, product_id=sofa.id, attribute_id=attr_color.id, option_id=opt_grey.id),
        ProductAttributeValue(tenant_id=tenant_id, product_id=sofa.id, attribute_id=attr_finish.id, option_id=opt_matte.id),
    ])

    # 2. LED Panel Light 18W
    led = Product(
        tenant_id=tenant_id,
        name="LED Panel Light 18W",
        description="Energy efficient round slim ceiling light",
        category_id=categories["Lighting"].id,
        brand_id=brands["Philips"].id,
        model="AstraLine",
        tax_rate_id=taxes["GST 18%"].id,
        created_by=user.id,
    )
    db.add(led)
    await db.flush()

    v_led = ProductVariant(
        tenant_id=tenant_id,
        product_id=led.id,
        sku="LED-PNL-18W-001",
        variant_name="18W Cool White",
        unit_id=units["PC"].id,
        purchase_price=Decimal("320.00"),
        selling_price=Decimal("550.00"),
        mrp=Decimal("650.00"),
        created_by=user.id,
    )
    db.add(v_led)
    await db.flush()

    db.add_all([
        ProductAttributeValue(tenant_id=tenant_id, product_id=led.id, attribute_id=attr_wattage.id, numeric_value=Decimal("18.0")),
        ProductAttributeValue(tenant_id=tenant_id, product_id=led.id, attribute_id=attr_voltage.id, numeric_value=Decimal("220.0")),
        ProductAttributeValue(tenant_id=tenant_id, product_id=led.id, attribute_id=attr_color_temp.id, option_id=opt_cool_white.id),
    ])

    # 3. SS Screw M6x25
    screw = Product(
        tenant_id=tenant_id,
        name="SS Screw M6×25",
        description="Stainless steel philips head screw",
        category_id=categories["Fasteners"].id,
        brand_id=brands["Fischer"].id,
        tax_rate_id=taxes["GST 18%"].id,
        created_by=user.id,
    )
    db.add(screw)
    await db.flush()

    v_screw = ProductVariant(
        tenant_id=tenant_id,
        product_id=screw.id,
        sku="SCR-SS-M6-25-001",
        variant_name="M6×25 SS 304 Box of 100",
        unit_id=units["BOX"].id,
        purchase_price=Decimal("250.00"),
        selling_price=Decimal("400.00"),
        mrp=Decimal("450.00"),
        created_by=user.id,
    )
    db.add(v_screw)
    await db.flush()

    db.add_all([
        ProductAttributeValue(tenant_id=tenant_id, product_id=screw.id, attribute_id=attr_diameter.id, decimal_value=Decimal("6.0")),
        ProductAttributeValue(tenant_id=tenant_id, product_id=screw.id, attribute_id=attr_length.id, decimal_value=Decimal("25.0")),
        ProductAttributeValue(tenant_id=tenant_id, product_id=screw.id, attribute_id=attr_grade.id, text_value="SS 304"),
    ])

    # 4. Wash Basin 550mm
    basin = Product(
        tenant_id=tenant_id,
        name="Wash Basin 550mm",
        description="Ceramic tabletop vanity wash basin",
        category_id=categories["Basins"].id,
        brand_id=brands["Jaquar"].id,
        model="Lyric",
        tax_rate_id=taxes["GST 18%"].id,
        created_by=user.id,
    )
    db.add(basin)
    await db.flush()

    v_basin = ProductVariant(
        tenant_id=tenant_id,
        product_id=basin.id,
        sku="BSN-CER-550-001",
        variant_name="White Tabletop 550mm",
        unit_id=units["PC"].id,
        purchase_price=Decimal("2800.00"),
        selling_price=Decimal("4500.00"),
        mrp=Decimal("5200.00"),
        created_by=user.id,
    )
    db.add(v_basin)
    await db.flush()

    db.add_all([
        ProductAttributeValue(tenant_id=tenant_id, product_id=basin.id, attribute_id=attr_size.id, decimal_value=Decimal("550.0")),
        ProductAttributeValue(tenant_id=tenant_id, product_id=basin.id, attribute_id=attr_san_mat.id, option_id=opt_ceramic.id),
    ])

    await db.commit()
    print("Demo data seeded successfully with 4 products, categories, attributes, units, and brands!")


async def run_seeds():
    async with AsyncSessionLocal() as session:
        await seed_demo_data(session)


if __name__ == "__main__":
    asyncio.run(run_seeds())
