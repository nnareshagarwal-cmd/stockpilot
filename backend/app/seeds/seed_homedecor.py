import asyncio
import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.modules.auth.models import Business, User
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

TENANT_ID = uuid.UUID("87f630e9-8c67-4b39-97bf-bf577e759ee8")  # HomeDecor
USER_ID = uuid.UUID("e5f6a6ba-4a26-40c7-a95a-d8a7fe1f9ac9")    # n.nareshagarwal@gmail.com


async def seed_homedecor():
    async with AsyncSessionLocal() as db:
        print(f"Connecting to database to seed furniture data for HomeDecor ({TENANT_ID})...")

        # 1. Verify Tenant & User
        b_res = await db.execute(select(Business).where(Business.id == TENANT_ID))
        business = b_res.scalar_one_or_none()
        if not business:
            print("HomeDecor business not found!")
            return

        # 2. Get Units and Tax Rates
        units_res = await db.execute(select(UnitOfMeasure).where(UnitOfMeasure.tenant_id == TENANT_ID))
        units = {u.code: u for u in units_res.scalars().all()}

        taxes_res = await db.execute(select(TaxRate).where(TaxRate.tenant_id == TENANT_ID))
        taxes = {t.name: t for t in taxes_res.scalars().all()}
        gst_18 = taxes.get("GST 18%")
        gst_12 = taxes.get("GST 12%")

        # 3. Get existing user locations
        locs_res = await db.execute(select(Location).where(Location.tenant_id == TENANT_ID))
        existing_locs = locs_res.scalars().all()
        loc_map = {l.code: l for l in existing_locs}
        print(f"Found {len(existing_locs)} existing locations in HomeDecor:")
        for l in existing_locs:
            print(f"  - {l.name} [{l.code}]")

        # 4. Create Top Furniture Brands
        brand_data = [
            ("Nilkamal", "Pioneer in molded furniture, home furniture, and mattresses", "https://www.nilkamal.com"),
            ("Godrej Interio", "Premium ergonomic home and office furniture", "https://www.godrejinterio.com"),
            ("Durian", "Luxury crafted solid wood furniture and leatherette sofas", "https://www.durian.in"),
            ("Wakefit", "Modern minimalist ergonomic furniture and orthopedic mattresses", "https://www.wakefit.co"),
            ("Urban Ladder", "Contemporary designer solid wood home decor and furniture", "https://www.urbanladder.com"),
            ("Sleepwell", "India's premier sleep support and orthopedic mattresses", "https://www.mysleepwell.com"),
            ("Kurl-on", "High-density bonded and coir mattresses", "https://www.kurl-on.com"),
            ("IKEA", "Scandinavian functional and flatpack home furnishing", "https://www.ikea.com/in"),
            ("RoyalOak", "International modern furniture designs across living and bedroom", "https://www.royaloakindia.com"),
            ("CenturyPly", "Premium hardwood and high-pressure decorative furniture", "https://www.centuryply.com"),
        ]

        brands = {}
        for b_name, b_desc, b_web in brand_data:
            existing_b = (await db.execute(select(Brand).where(Brand.tenant_id == TENANT_ID, Brand.name == b_name))).scalar_one_or_none()
            if not existing_b:
                brand_obj = Brand(tenant_id=TENANT_ID, name=b_name, description=b_desc, website=b_web, is_active=True)
                db.add(brand_obj)
                await db.flush()
                brands[b_name] = brand_obj
            else:
                brands[b_name] = existing_b
        print(f"Brands ready: {list(brands.keys())}")

        # 5. Create Categories Taxonomy (from Pepperfry screenshots)
        # Root Categories
        taxonomy = {
            "Sofas & Seating": [
                ("3 Seater Sofas", "SOFA-3S"),
                ("2 Seater Sofas", "SOFA-2S"),
                ("1 Seater Sofas", "SOFA-1S"),
                ("Sectional Sofas", "SOFA-SEC"),
                ("Sofa Cum Beds", "SOFA-BED"),
                ("Recliners", "RECLINER"),
                ("Accent & Lounge Chairs", "CHAIR-ACC"),
                ("Settees & Benches", "BENCH"),
                ("Ottomans & Pouffes", "OTTOMAN"),
            ],
            "Living Tables & Storage": [
                ("Centre & Coffee Tables", "TBL-CTR"),
                ("Side & End Tables", "TBL-SIDE"),
                ("TV & Media Units", "TV-UNIT"),
                ("Book Shelves & Display", "SHELF-BK"),
                ("Shoe Racks & Cabinets", "SHOE-RCK"),
                ("Cabinets & Sideboards", "CABINET"),
            ],
            "Bedroom Furniture": [
                ("King Size Beds", "BED-KING"),
                ("Queen Size Beds", "BED-QUEEN"),
                ("Single Beds", "BED-SGL"),
                ("4 Door Wardrobes", "WRD-4D"),
                ("Sliding Door Wardrobes", "WRD-SLD"),
                ("Bedside Tables", "BED-SIDE"),
                ("Dressing Tables", "DRS-TBL"),
                ("Chest of Drawers", "CHEST-DRW"),
            ],
            "Mattresses": [
                ("King Size Mattresses", "MAT-KING"),
                ("Queen Size Mattresses", "MAT-QUEEN"),
                ("Single Size Mattresses", "MAT-SGL"),
                ("Foldable Mattresses", "MAT-FOLD"),
            ],
            "Dining & Bar": [
                ("6 Seater Dining Sets", "DIN-6S"),
                ("4 Seater Dining Sets", "DIN-4S"),
                ("Dining Tables & Chairs", "DIN-TBL"),
                ("Bar Cabinets & Stools", "BAR-FURN"),
                ("Crockery Units", "CROCKERY"),
            ],
            "Office & Study": [
                ("Study & Computer Desks", "STDY-DSK"),
                ("Office Chairs", "OFF-CHR"),
                ("Office Storage", "OFF-STOR"),
            ],
            "Balcony & Outdoor": [
                ("Swings & Hammocks", "OUT-SWG"),
                ("Outdoor Sets", "OUT-SET"),
            ],
        }

        cat_lookup = {}
        for root_name, subs in taxonomy.items():
            r_cat = (await db.execute(select(Category).where(Category.tenant_id == TENANT_ID, Category.name == root_name))).scalar_one_or_none()
            if not r_cat:
                r_cat = Category(tenant_id=TENANT_ID, name=root_name, is_active=True, created_by=USER_ID)
                db.add(r_cat)
                await db.flush()
            cat_lookup[root_name] = r_cat

            for sub_name, sub_code in subs:
                s_cat = (await db.execute(select(Category).where(Category.tenant_id == TENANT_ID, Category.name == sub_name))).scalar_one_or_none()
                if not s_cat:
                    s_cat = Category(
                        tenant_id=TENANT_ID,
                        name=sub_name,
                        code=sub_code,
                        parent_id=r_cat.id,
                        is_active=True,
                        created_by=USER_ID,
                    )
                    db.add(s_cat)
                    await db.flush()
                cat_lookup[sub_name] = s_cat

        print(f"Categories seeded: {len(cat_lookup)} categories and subcategories created.")

        # 6. Create Common Attributes & Options
        async def get_or_create_attr(name: str, code: str, dtype: str, options=None):
            a_res = await db.execute(select(AttributeDefinition).where(AttributeDefinition.tenant_id == TENANT_ID, AttributeDefinition.code == code))
            attr = a_res.scalar_one_or_none()
            if not attr:
                attr = AttributeDefinition(
                    tenant_id=TENANT_ID,
                    name=name,
                    code=code,
                    data_type=dtype,
                    is_searchable=True,
                    is_filterable=True,
                )
                db.add(attr)
                await db.flush()
                if options:
                    for i, opt in enumerate(options):
                        o = AttributeOption(attribute_id=attr.id, value=opt, sort_order=i + 1)
                        db.add(o)
                    await db.flush()
            return attr

        attr_material = await get_or_create_attr(
            "Primary Material", "prim_material", "single_choice",
            ["Sheesham Wood", "Teak Wood", "Engineered Wood", "Solid Oak", "Metal Frame", "Velvet Fabric", "Polyester Fabric", "Leatherette", "High Density Foam"]
        )
        attr_finish = await get_or_create_attr(
            "Color & Finish", "color_finish", "single_choice",
            ["Walnut Finish", "Teak Finish", "Honey Oak", "Charcoal Grey", "Navy Blue", "Warm Beige", "Matte Black", "Emerald Green", "Chestnut Brown"]
        )
        attr_capacity = await get_or_create_attr(
            "Seating Capacity", "seat_capacity", "number"
        )
        attr_storage = await get_or_create_attr(
            "Storage Included", "storage_type", "single_choice",
            ["Box Storage", "Hydraulic Lift-Up", "Drawer Storage", "Open Shelf", "None"]
        )

        # Attribute for Location display (referencing the user's created locations!)
        loc_options = [f"{l.name} [{l.code}]" for l in existing_locs] if existing_locs else ["Showroom Ground Floor [STORE-01-GF]"]
        attr_display_loc = await get_or_create_attr(
            "Floor / Godown Location", "assigned_location", "single_choice",
            loc_options
        )

        # Load options map
        opts_res = await db.execute(select(AttributeOption))
        all_opts = {(o.attribute_id, o.value): o.id for o in opts_res.scalars().all()}

        # 7. 20 Realistic Furniture Products
        products_spec = [
            # 1. 3 Seater Sofa
            {
                "name": "Stargazer 3-Seater Velvet Luxury Sofa",
                "category": "3 Seater Sofas",
                "brand": "Wakefit",
                "model": "Stargazer Royal",
                "description": "Ergonomic high-density foam 3-seater sofa with tufted backrest and premium stain-resistant velvet fabric.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "WF-SOFA-3S-NAVY",
                        "variant_name": "Royal Navy Blue Velvet",
                        "purchase_price": Decimal("16500.00"),
                        "selling_price": Decimal("28999.00"),
                        "mrp": Decimal("35999.00"),
                        "barcode": "89040011001",
                        "loc": "Showroom Ground Floor [STORE-01-GF]",
                    },
                    {
                        "sku": "WF-SOFA-3S-GRY",
                        "variant_name": "Charcoal Grey Velvet",
                        "purchase_price": Decimal("16500.00"),
                        "selling_price": Decimal("28999.00"),
                        "mrp": Decimal("35999.00"),
                        "barcode": "89040011002",
                        "loc": "Showroom First Floor [STORE-01-FF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Velvet Fabric"),
                    attr_finish.id: ("option", "Navy Blue"),
                    attr_capacity.id: ("number", Decimal("3")),
                    attr_storage.id: ("option", "None"),
                    attr_display_loc.id: ("option", "Showroom Ground Floor [STORE-01-GF]"),
                },
            },
            # 2. Chesterfield 3-Seater Sofa
            {
                "name": "King Chesterfield Deep Tufted 3-Seater Sofa",
                "category": "3 Seater Sofas",
                "brand": "Durian",
                "model": "Chesterfield Classic",
                "description": "Handcrafted rolled-arm deep button-tufted luxury sofa with solid sal wood frame and antique brass nailhead trim.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "DUR-CHEST-3S-BRN",
                        "variant_name": "Chestnut Brown Vintage Leatherette",
                        "purchase_price": Decimal("24500.00"),
                        "selling_price": Decimal("44500.00"),
                        "mrp": Decimal("52000.00"),
                        "barcode": "89040011003",
                        "loc": "Showroom Ground Floor [STORE-01-GF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Leatherette"),
                    attr_finish.id: ("option", "Chestnut Brown"),
                    attr_capacity.id: ("number", Decimal("3")),
                    attr_storage.id: ("option", "None"),
                    attr_display_loc.id: ("option", "Showroom Ground Floor [STORE-01-GF]"),
                },
            },
            # 3. 2 Seater Sofa
            {
                "name": "Apollo Compact 2-Seater Fabric Sofa",
                "category": "2 Seater Sofas",
                "brand": "Urban Ladder",
                "model": "Apollo Living",
                "description": "Space-saving compact love-seat couch perfect for apartments, study rooms, and modern living spaces.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "UL-APOLLO-2S-BEI",
                        "variant_name": "Warm Oatmeal Beige Fabric",
                        "purchase_price": Decimal("11200.00"),
                        "selling_price": Decimal("18999.00"),
                        "mrp": Decimal("24000.00"),
                        "barcode": "89040011004",
                        "loc": "Showroom First Floor [STORE-01-FF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Polyester Fabric"),
                    attr_finish.id: ("option", "Warm Beige"),
                    attr_capacity.id: ("number", Decimal("2")),
                    attr_storage.id: ("option", "None"),
                    attr_display_loc.id: ("option", "Showroom First Floor [STORE-01-FF]"),
                },
            },
            # 4. Sectional Corner Sofa
            {
                "name": "Melaka L-Shaped Sectional Corner Sofa with Chaise",
                "category": "Sectional Sofas",
                "brand": "RoyalOak",
                "model": "Melaka Grand L",
                "description": "Family sectional sofa with interchangeable chaise lounger and pocket spring cushioning for maximum comfort.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "RO-MELAKA-LHS-GRY",
                        "variant_name": "Left Hand Sectional (LHS) Grey",
                        "purchase_price": Decimal("28000.00"),
                        "selling_price": Decimal("48999.00"),
                        "mrp": Decimal("58000.00"),
                        "barcode": "89040011005",
                        "loc": "Showroom Ground Floor [STORE-01-GF]",
                    },
                    {
                        "sku": "RO-MELAKA-RHS-GRY",
                        "variant_name": "Right Hand Sectional (RHS) Grey",
                        "purchase_price": Decimal("28000.00"),
                        "selling_price": Decimal("48999.00"),
                        "mrp": Decimal("58000.00"),
                        "barcode": "89040011006",
                        "loc": "Gali Godown Ground Floor [Godown-01-GF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Polyester Fabric"),
                    attr_finish.id: ("option", "Charcoal Grey"),
                    attr_capacity.id: ("number", Decimal("5")),
                    attr_storage.id: ("option", "None"),
                    attr_display_loc.id: ("option", "Showroom Ground Floor [STORE-01-GF]"),
                },
            },
            # 5. Sofa Cum Bed
            {
                "name": "Slumber Velvet Sofa Cum Bed with Lift-Up Storage",
                "category": "Sofa Cum Beds",
                "brand": "Wakefit",
                "model": "Slumber Convertible",
                "description": "Smooth fold-out sofa that turns into a queen size guest bed in 30 seconds with internal hydraulic box storage.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "WF-SOFABED-BLU",
                        "variant_name": "Sapphire Blue Velvet Queen",
                        "purchase_price": Decimal("18500.00"),
                        "selling_price": Decimal("31999.00"),
                        "mrp": Decimal("39000.00"),
                        "barcode": "89040011007",
                        "loc": "Showroom First Floor [STORE-01-FF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Velvet Fabric"),
                    attr_finish.id: ("option", "Navy Blue"),
                    attr_capacity.id: ("number", Decimal("3")),
                    attr_storage.id: ("option", "Hydraulic Lift-Up"),
                    attr_display_loc.id: ("option", "Showroom First Floor [STORE-01-FF]"),
                },
            },
            # 6. Recliner
            {
                "name": "Motion Manual Rocker Recliner 1-Seater",
                "category": "Recliners",
                "brand": "Godrej Interio",
                "model": "Motion Relax",
                "description": "3-stage reclining ergonomic lounger with multi-density foam and sturdy steel reclining mechanism.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "GI-RECLINER-1S-BRN",
                        "variant_name": "Mocha Brown Breathable Fabric",
                        "purchase_price": Decimal("14000.00"),
                        "selling_price": Decimal("24500.00"),
                        "mrp": Decimal("29999.00"),
                        "barcode": "89040011008",
                        "loc": "Showroom Ground Floor [STORE-01-GF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Polyester Fabric"),
                    attr_finish.id: ("option", "Chestnut Brown"),
                    attr_capacity.id: ("number", Decimal("1")),
                    attr_storage.id: ("option", "None"),
                    attr_display_loc.id: ("option", "Showroom Ground Floor [STORE-01-GF]"),
                },
            },
            # 7. King Size Bed with Storage
            {
                "name": "Eleanor Solid Sheesham Wood King Bed with Box Storage",
                "category": "King Size Beds",
                "brand": "Urban Ladder",
                "model": "Eleanor King 78x72",
                "description": "Master bedroom solid Sheesham wood king size bed with slatted acoustic headboard and 4-compartment box storage.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "UL-BED-KNG-WAL",
                        "variant_name": "Warm Walnut Polish (78x72 in)",
                        "purchase_price": Decimal("23000.00"),
                        "selling_price": Decimal("39999.00"),
                        "mrp": Decimal("48000.00"),
                        "barcode": "89040011009",
                        "loc": "Showroom Second Floor [STORE-01-SF]",
                    },
                    {
                        "sku": "UL-BED-KNG-TEAK",
                        "variant_name": "Golden Teak Polish (78x72 in)",
                        "purchase_price": Decimal("23000.00"),
                        "selling_price": Decimal("39999.00"),
                        "mrp": Decimal("48000.00"),
                        "barcode": "89040011010",
                        "loc": "Gali Godown First Floor [Godown-01-FF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Sheesham Wood"),
                    attr_finish.id: ("option", "Walnut Finish"),
                    attr_capacity.id: ("number", Decimal("2")),
                    attr_storage.id: ("option", "Box Storage"),
                    attr_display_loc.id: ("option", "Showroom Second Floor [STORE-01-SF]"),
                },
            },
            # 8. Queen Bed Hydraulic
            {
                "name": "Taurus Engineered Wood Queen Bed with Hydraulic Lift",
                "category": "Queen Size Beds",
                "brand": "Wakefit",
                "model": "Taurus Hydraulic Queen",
                "description": "Effortless gas-lift hydraulic storage mechanism revealing 850L storage capacity beneath heavy duty mattress slats.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "WF-BED-QUN-HYD",
                        "variant_name": "Columbian Walnut (78x60 in)",
                        "purchase_price": Decimal("15500.00"),
                        "selling_price": Decimal("25999.00"),
                        "mrp": Decimal("32000.00"),
                        "barcode": "89040011011",
                        "loc": "Showroom Second Floor [STORE-01-SF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Engineered Wood"),
                    attr_finish.id: ("option", "Walnut Finish"),
                    attr_capacity.id: ("number", Decimal("2")),
                    attr_storage.id: ("option", "Hydraulic Lift-Up"),
                    attr_display_loc.id: ("option", "Showroom Second Floor [STORE-01-SF]"),
                },
            },
            # 9. 4 Door Wardrobe
            {
                "name": "Novella 4-Door Wardrobe with Full-Length Mirror & Drawers",
                "category": "4 Door Wardrobes",
                "brand": "Nilkamal",
                "model": "Novella 4D Grand",
                "description": "Spacious wardrobe with dual internal hanging rods, locker compartment, 4 inner shelves, and 2 bottom soft-close drawers.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "NIL-WRD-4D-WEN",
                        "variant_name": "Wenge Dark Wood Finish",
                        "purchase_price": Decimal("16000.00"),
                        "selling_price": Decimal("26999.00"),
                        "mrp": Decimal("33500.00"),
                        "barcode": "89040011012",
                        "loc": "Showroom Second Floor [STORE-01-SF]",
                    },
                    {
                        "sku": "NIL-WRD-4D-OAK",
                        "variant_name": "Natural Honey Oak Finish",
                        "purchase_price": Decimal("16000.00"),
                        "selling_price": Decimal("26999.00"),
                        "mrp": Decimal("33500.00"),
                        "barcode": "89040011013",
                        "loc": "Gali Godown Second Floor [Godown-01-SF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Engineered Wood"),
                    attr_finish.id: ("option", "Honey Oak"),
                    attr_storage.id: ("option", "Drawer Storage"),
                    attr_display_loc.id: ("option", "Showroom Second Floor [STORE-01-SF]"),
                },
            },
            # 10. Sliding Wardrobe
            {
                "name": "Bradford Modern Sliding 3-Door Wardrobe 7x6 ft",
                "category": "Sliding Door Wardrobes",
                "brand": "Urban Ladder",
                "model": "Bradford Slider 210",
                "description": "Smooth aluminum track dual sliding doors with frosted glass accent panel and moisture-resistant particle board carcass.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "UL-WRD-SLD-WAL",
                        "variant_name": "Walnut & Frosted Glass Panel",
                        "purchase_price": Decimal("26000.00"),
                        "selling_price": Decimal("42999.00"),
                        "mrp": Decimal("51000.00"),
                        "barcode": "89040011014",
                        "loc": "Showroom Second Floor [STORE-01-SF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Engineered Wood"),
                    attr_finish.id: ("option", "Walnut Finish"),
                    attr_storage.id: ("option", "Drawer Storage"),
                    attr_display_loc.id: ("option", "Showroom Second Floor [STORE-01-SF]"),
                },
            },
            # 11. King Size Mattress
            {
                "name": "Spinetech Air Luxury Orthopedic King Mattress 8-Inch",
                "category": "King Size Mattresses",
                "brand": "Sleepwell",
                "model": "Spinetech Air 8",
                "description": "Doctor recommended spinal alignment 3-zone pocket spring with breathable memory foam euro top and anti-microbial knitted fabric.",
                "tax": gst_12 or gst_18,
                "variants": [
                    {
                        "sku": "SLP-MAT-KNG-7872",
                        "variant_name": "King (78 x 72 x 8 Inch)",
                        "purchase_price": Decimal("14500.00"),
                        "selling_price": Decimal("24500.00"),
                        "mrp": Decimal("31000.00"),
                        "barcode": "89040011015",
                        "loc": "Showroom Second Floor [STORE-01-SF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "High Density Foam"),
                    attr_finish.id: ("option", "Warm Beige"),
                    attr_display_loc.id: ("option", "Showroom Second Floor [STORE-01-SF]"),
                },
            },
            # 12. Queen Mattress
            {
                "name": "Ortho Dual Comfort Queen Size Mattress 6-Inch",
                "category": "Queen Size Mattresses",
                "brand": "Wakefit",
                "model": "Dual Comfort 6",
                "description": "Reversible mattress featuring high resilience firm foam on one side and plush pressure-relieving foam on the other.",
                "tax": gst_12 or gst_18,
                "variants": [
                    {
                        "sku": "WF-MAT-QUN-7860",
                        "variant_name": "Queen (78 x 60 x 6 Inch)",
                        "purchase_price": Decimal("8200.00"),
                        "selling_price": Decimal("13999.00"),
                        "mrp": Decimal("17500.00"),
                        "barcode": "89040011016",
                        "loc": "Gali Godown Ground Floor [Godown-01-GF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "High Density Foam"),
                    attr_finish.id: ("option", "Warm Beige"),
                    attr_display_loc.id: ("option", "Gali Godown Ground Floor [Godown-01-GF]"),
                },
            },
            # 13. 6 Seater Dining Set
            {
                "name": "Raymond 6-Seater Solid Wood Dining Table with Cushioned Chairs",
                "category": "6 Seater Dining Sets",
                "brand": "Urban Ladder",
                "model": "Raymond 6S Grand",
                "description": "Premium solid Sheesham wood rectangular dining table with 6 high-back curved ergonomic padded dining chairs.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "UL-DIN-6S-TEAK",
                        "variant_name": "Teak Wood Finish (Table + 6 Chairs)",
                        "purchase_price": Decimal("26000.00"),
                        "selling_price": Decimal("45999.00"),
                        "mrp": Decimal("56000.00"),
                        "barcode": "89040011017",
                        "loc": "Showroom First Floor [STORE-01-FF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Sheesham Wood"),
                    attr_finish.id: ("option", "Teak Finish"),
                    attr_capacity.id: ("number", Decimal("6")),
                    attr_storage.id: ("option", "None"),
                    attr_display_loc.id: ("option", "Showroom First Floor [STORE-01-FF]"),
                },
            },
            # 14. 4 Seater Dining Set
            {
                "name": "Apex 4-Seater Solid Wood Dining Table Set",
                "category": "4 Seater Dining Sets",
                "brand": "Durian",
                "model": "Apex 4S Compact",
                "description": "Compact dining table set featuring curved corners and easy-clean water repellent upholstered seats.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "DUR-DIN-4S-WAL",
                        "variant_name": "Walnut Polish (Table + 4 Chairs)",
                        "purchase_price": Decimal("15000.00"),
                        "selling_price": Decimal("26999.00"),
                        "mrp": Decimal("33000.00"),
                        "barcode": "89040011018",
                        "loc": "Showroom First Floor [STORE-01-FF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Solid Oak"),
                    attr_finish.id: ("option", "Walnut Finish"),
                    attr_capacity.id: ("number", Decimal("4")),
                    attr_storage.id: ("option", "None"),
                    attr_display_loc.id: ("option", "Showroom First Floor [STORE-01-FF]"),
                },
            },
            # 15. Centre Coffee Table
            {
                "name": "Arabica Solid Sheesham Coffee Table with 4 Stools",
                "category": "Centre & Coffee Tables",
                "brand": "Urban Ladder",
                "model": "Arabica Nesting Plus",
                "description": "Square central coffee table with 4 upholstered nesting pouffe stools that tuck underneath cleanly.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "UL-CTR-TBL-4ST",
                        "variant_name": "Teak Finish with 4 Cream Stools",
                        "purchase_price": Decimal("8500.00"),
                        "selling_price": Decimal("15499.00"),
                        "mrp": Decimal("19000.00"),
                        "barcode": "89040011019",
                        "loc": "Showroom Ground Floor [STORE-01-GF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Sheesham Wood"),
                    attr_finish.id: ("option", "Teak Finish"),
                    attr_capacity.id: ("number", Decimal("4")),
                    attr_storage.id: ("option", "Open Shelf"),
                    attr_display_loc.id: ("option", "Showroom Ground Floor [STORE-01-GF]"),
                },
            },
            # 16. TV & Media Entertainment Unit
            {
                "name": "Aura Wall-Mounted Floating TV Entertainment Unit 180cm",
                "category": "TV & Media Units",
                "brand": "Godrej Interio",
                "model": "Aura Floating 180",
                "description": "Modern wall-hung console with cable pass-through grommets, push-to-open cabinets, and open set-top-box shelf.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "GI-TV-UNIT-180-WAL",
                        "variant_name": "Walnut & Matte White (Up to 65 inch TV)",
                        "purchase_price": Decimal("6800.00"),
                        "selling_price": Decimal("12499.00"),
                        "mrp": Decimal("15999.00"),
                        "barcode": "89040011020",
                        "loc": "Showroom First Floor [STORE-01-FF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Engineered Wood"),
                    attr_finish.id: ("option", "Walnut Finish"),
                    attr_storage.id: ("option", "Drawer Storage"),
                    attr_display_loc.id: ("option", "Showroom First Floor [STORE-01-FF]"),
                },
            },
            # 17. Bookshelf
            {
                "name": "Freedom Multi-Tier Engineered Wood Display Bookshelf",
                "category": "Book Shelves & Display",
                "brand": "Nilkamal",
                "model": "Freedom 5-Tier",
                "description": "5-tier vertical open shelving rack with anti-toppling hardware for books, decor curios, and house plants.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "NIL-BSHELF-5T-TEAK",
                        "variant_name": "Teak Brown 5-Tier (H: 175cm)",
                        "purchase_price": Decimal("4200.00"),
                        "selling_price": Decimal("7499.00"),
                        "mrp": Decimal("9999.00"),
                        "barcode": "89040011021",
                        "loc": "Showroom Third Floor [STORE-01-TF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Engineered Wood"),
                    attr_finish.id: ("option", "Teak Finish"),
                    attr_storage.id: ("option", "Open Shelf"),
                    attr_display_loc.id: ("option", "Showroom Third Floor [STORE-01-TF]"),
                },
            },
            # 18. Shoe Rack Cabinet
            {
                "name": "Woodrich 3-Door Entryway Shoe Cabinet with Top Cushion Seat",
                "category": "Shoe Racks & Cabinets",
                "brand": "Godrej Interio",
                "model": "Woodrich Seat 3D",
                "description": "Slatted louvered door shoe organizer holding up to 18 pairs with integrated top padded bench for wearing footwear.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "GI-SHOE-CAB-OAK",
                        "variant_name": "Oak Finish with Grey Seat Cushion",
                        "purchase_price": Decimal("5500.00"),
                        "selling_price": Decimal("9999.00"),
                        "mrp": Decimal("12999.00"),
                        "barcode": "89040011022",
                        "loc": "Showroom Ground Floor [STORE-01-GF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Engineered Wood"),
                    attr_finish.id: ("option", "Honey Oak"),
                    attr_storage.id: ("option", "Drawer Storage"),
                    attr_display_loc.id: ("option", "Showroom Ground Floor [STORE-01-GF]"),
                },
            },
            # 19. Office Ergonomic Chair
            {
                "name": "Tartan High-Back Mesh Ergonomic Office Chair",
                "category": "Office Chairs",
                "brand": "Wakefit",
                "model": "Tartan High Back",
                "description": "BIFMA certified breathable mesh chair with 2D adjustable lumbar support, 3D armrests, and synchro-tilt lock.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "WF-OFF-CHR-BLK",
                        "variant_name": "Full Black Mesh with Chrome Base",
                        "purchase_price": Decimal("5200.00"),
                        "selling_price": Decimal("8999.00"),
                        "mrp": Decimal("12000.00"),
                        "barcode": "89040011023",
                        "loc": "Showroom Third Floor [STORE-01-TF]",
                    },
                    {
                        "sku": "WF-OFF-CHR-GRY",
                        "variant_name": "Slate Grey Mesh with White Frame",
                        "purchase_price": Decimal("5400.00"),
                        "selling_price": Decimal("9499.00"),
                        "mrp": Decimal("12500.00"),
                        "barcode": "89040011024",
                        "loc": "Gali Godown Third Floor [Godown-01-TF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Metal Frame"),
                    attr_finish.id: ("option", "Matte Black"),
                    attr_capacity.id: ("number", Decimal("1")),
                    attr_storage.id: ("option", "None"),
                    attr_display_loc.id: ("option", "Showroom Third Floor [STORE-01-TF]"),
                },
            },
            # 20. Outdoor Hanging Swing
            {
                "name": "Castara All-Weather Balcony Hanging Swing Chair with Heavy Duty Stand",
                "category": "Swings & Hammocks",
                "brand": "RoyalOak",
                "model": "Castara Egg Swing",
                "description": "UV-resistant teardrop wicker rattan pod with spring suspension steel frame and deep water-repellent tufted cushion.",
                "tax": gst_18,
                "variants": [
                    {
                        "sku": "RO-SWING-WKR-BRN",
                        "variant_name": "Coffee Brown Wicker + Crimson Red Cushion",
                        "purchase_price": Decimal("7200.00"),
                        "selling_price": Decimal("13999.00"),
                        "mrp": Decimal("18000.00"),
                        "barcode": "89040011025",
                        "loc": "Showroom Third Floor [STORE-01-TF]",
                    },
                ],
                "attrs": {
                    attr_material.id: ("option", "Metal Frame"),
                    attr_finish.id: ("option", "Chestnut Brown"),
                    attr_capacity.id: ("number", Decimal("1")),
                    attr_storage.id: ("option", "None"),
                    attr_display_loc.id: ("option", "Showroom Third Floor [STORE-01-TF]"),
                },
            },
        ]

        count_created = 0
        for p_spec in products_spec:
            cat_obj = cat_lookup.get(p_spec["category"])
            brand_obj = brands.get(p_spec["brand"])
            tax_obj = p_spec["tax"]

            # Check if product already exists
            existing_p = (await db.execute(
                select(Product).where(Product.tenant_id == TENANT_ID, Product.name == p_spec["name"])
            )).scalar_one_or_none()

            if not existing_p:
                prod = Product(
                    tenant_id=TENANT_ID,
                    name=p_spec["name"],
                    description=p_spec["description"],
                    category_id=cat_obj.id if cat_obj else None,
                    brand_id=brand_obj.id if brand_obj else None,
                    model=p_spec["model"],
                    tax_rate_id=tax_obj.id if tax_obj else None,
                    is_active=True,
                    created_by=USER_ID,
                )
                db.add(prod)
                await db.flush()

                # Add Variants
                for v_info in p_spec["variants"]:
                    var = ProductVariant(
                        tenant_id=TENANT_ID,
                        product_id=prod.id,
                        sku=v_info["sku"],
                        variant_name=v_info["variant_name"],
                        barcode=v_info.get("barcode"),
                        unit_id=units.get("PC", list(units.values())[0]).id,
                        purchase_price=v_info["purchase_price"],
                        selling_price=v_info["selling_price"],
                        mrp=v_info["mrp"],
                        reorder_point=Decimal("2"),
                        reorder_quantity=Decimal("5"),
                        is_active=True,
                        created_by=USER_ID,
                    )
                    db.add(var)
                    await db.flush()

                    # Add initial price history
                    ph_sell = PriceHistory(
                        tenant_id=TENANT_ID,
                        variant_id=var.id,
                        price_type="selling",
                        old_price=None,
                        new_price=var.selling_price,
                        reason="Initial catalog launch",
                        changed_by=USER_ID,
                    )
                    ph_pur = PriceHistory(
                        tenant_id=TENANT_ID,
                        variant_id=var.id,
                        price_type="purchase",
                        old_price=None,
                        new_price=var.purchase_price,
                        reason="Initial purchase cost",
                        changed_by=USER_ID,
                    )
                    db.add_all([ph_sell, ph_pur])

                # Add Attributes
                for a_id, (val_type, val) in p_spec.get("attrs", {}).items():
                    if val_type == "option":
                        opt_id = all_opts.get((a_id, val))
                        if opt_id:
                            pav = ProductAttributeValue(
                                tenant_id=TENANT_ID,
                                product_id=prod.id,
                                attribute_id=a_id,
                                option_id=opt_id,
                            )
                            db.add(pav)
                    elif val_type == "number":
                        pav = ProductAttributeValue(
                            tenant_id=TENANT_ID,
                            product_id=prod.id,
                            attribute_id=a_id,
                            numeric_value=val,
                        )
                        db.add(pav)
                    elif val_type == "text":
                        pav = ProductAttributeValue(
                            tenant_id=TENANT_ID,
                            product_id=prod.id,
                            attribute_id=a_id,
                            text_value=val,
                        )
                        db.add(pav)

                await db.flush()
                count_created += 1
                print(f"[{count_created}/20] Created Product: {prod.name} ({p_spec['brand']}) with {len(p_spec['variants'])} variants.")

        await db.commit()
        print(f"\nSUCCESS! Seeded {count_created} products for HomeDecor tenant with categories, brands, variants, and specs!")


if __name__ == "__main__":
    asyncio.run(seed_homedecor())
