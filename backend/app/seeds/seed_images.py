import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import AsyncSessionLocal
from app.modules.auth.models import Business, User
from app.modules.settings.models import Category, Brand, TaxRate, UnitOfMeasure
from app.modules.catalogue.models import Product, ProductImage, ProductVariant, ProductAttributeValue

# High-resolution, professional furniture imagery mapped to each product name
IMAGE_MAP = {
    # 1. 3-Seater Sofas
    "Stargazer 3-Seater Velvet Luxury Sofa": [
        (
            "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=800&q=80",
            "stargazer_sofa_yellow.jpg",
            "Stargazer Modern Velvet 3-Seater Sofa",
        ),
        (
            "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80",
            "stargazer_sofa_green.jpg",
            "Stargazer Emerald Green Side View",
        ),
    ],
    "King Chesterfield Deep Tufted 3-Seater Sofa": [
        (
            "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80",
            "chesterfield_sofa_brown.jpg",
            "King Chesterfield Hand-Tufted Leatherette Sofa",
        ),
    ],
    # 2. 2-Seater Sofa
    "Apollo Compact 2-Seater Fabric Sofa": [
        (
            "https://images.unsplash.com/photo-1540574163026-643ea20ade25?auto=format&fit=crop&w=800&q=80",
            "apollo_sofa_beige.jpg",
            "Apollo Compact 2-Seater Scandinavian Couch",
        ),
    ],
    # 3. Sectional Sofa
    "Melaka L-Shaped Sectional Corner Sofa with Chaise": [
        (
            "https://images.unsplash.com/photo-1512212621149-107ffe572d2f?auto=format&fit=crop&w=800&q=80",
            "melaka_sectional_teal.jpg",
            "Melaka Modern L-Shaped Sectional Sofa with Lounger",
        ),
    ],
    # 4. Sofa Cum Bed
    "Slumber Velvet Sofa Cum Bed with Lift-Up Storage": [
        (
            "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
            "slumber_sofacumbed_yellow.jpg",
            "Slumber Convertible Fold-Out Sofa Cum Bed",
        ),
    ],
    # 5. Recliner
    "Motion Manual Rocker Recliner 1-Seater": [
        (
            "https://images.unsplash.com/photo-1580481077195-c22ae2499d07?auto=format&fit=crop&w=800&q=80",
            "motion_recliner_blue.jpg",
            "Motion Relax 1-Seater Ergonomic Recliner Armchair",
        ),
    ],
    # 6. King Size Bed
    "Eleanor Solid Sheesham Wood King Bed with Box Storage": [
        (
            "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
            "eleanor_king_bed.jpg",
            "Eleanor Solid Sheesham King Bed with Storage",
        ),
    ],
    # 7. Queen Size Bed
    "Taurus Engineered Wood Queen Bed with Hydraulic Lift": [
        (
            "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=800&q=80",
            "taurus_queen_bed.jpg",
            "Taurus Hydraulic Storage Queen Size Bed",
        ),
    ],
    # 8. 4 Door Wardrobe
    "Novella 4-Door Wardrobe with Full-Length Mirror & Drawers": [
        (
            "https://images.unsplash.com/photo-1558997519-83ea9252def8?auto=format&fit=crop&w=800&q=80",
            "novella_wardrobe_mirror.jpg",
            "Novella 4-Door Wooden Wardrobe with Full Mirror",
        ),
    ],
    # 9. Sliding Wardrobe
    "Bradford Modern Sliding 3-Door Wardrobe 7x6 ft": [
        (
            "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80",
            "bradford_sliding_wardrobe.jpg",
            "Bradford Contemporary 3-Door Sliding Wardrobe",
        ),
    ],
    # 10. King Mattress
    "Spinetech Air Luxury Orthopedic King Mattress 8-Inch": [
        (
            "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80",
            "spinetech_king_mattress.jpg",
            "Spinetech Air Luxury Orthopedic King Mattress",
        ),
    ],
    # 11. Queen Mattress
    "Ortho Dual Comfort Queen Size Mattress 6-Inch": [
        (
            "https://images.unsplash.com/photo-1629949009765-40fc74c95018?auto=format&fit=crop&w=800&q=80",
            "ortho_queen_mattress.jpg",
            "Ortho Dual Comfort Reversible Queen Mattress",
        ),
    ],
    # 12. 6-Seater Dining Set
    "Raymond 6-Seater Solid Wood Dining Table with Cushioned Chairs": [
        (
            "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=800&q=80",
            "raymond_dining_6seater.jpg",
            "Raymond Solid Wood 6-Seater Dining Set with Bench",
        ),
    ],
    # 13. 4-Seater Dining Set
    "Apex 4-Seater Solid Wood Dining Table Set": [
        (
            "https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?auto=format&fit=crop&w=800&q=80",
            "apex_dining_4seater.jpg",
            "Apex Solid Teak Wood 4-Seater Dining Table Set",
        ),
    ],
    # 14. Centre Coffee Table
    "Arabica Solid Sheesham Coffee Table with 4 Stools": [
        (
            "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=800&q=80",
            "arabica_coffee_table.jpg",
            "Arabica Solid Sheesham Centre Coffee Table",
        ),
    ],
    # 15. TV Entertainment Unit
    "Aura Wall-Mounted Floating TV Entertainment Unit 180cm": [
        (
            "https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=800&q=80",
            "aura_tv_unit.jpg",
            "Aura Floating TV Media Console 180cm",
        ),
    ],
    # 16. Bookshelf
    "Freedom Multi-Tier Engineered Wood Display Bookshelf": [
        (
            "https://images.unsplash.com/photo-1594652634010-275456c808d0?auto=format&fit=crop&w=800&q=80",
            "freedom_bookshelf_wood.jpg",
            "Freedom 5-Tier Vertical Wooden Bookshelf",
        ),
    ],
    # 17. Shoe Rack Cabinet
    "Woodrich 3-Door Entryway Shoe Cabinet with Top Cushion Seat": [
        (
            "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
            "woodrich_shoe_cabinet.jpg",
            "Woodrich 3-Door Shoe Organizer with Seat",
        ),
    ],
    # 18. Office Ergonomic Chair (Matching Image 5)
    "Tartan High-Back Mesh Ergonomic Office Chair": [
        (
            "https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&w=800&q=80",
            "tartan_office_chair_mesh.jpg",
            "Tartan High-Back Mesh Ergonomic Office Chair",
        ),
        (
            "https://images.unsplash.com/photo-1580481077195-c22ae2499d07?auto=format&fit=crop&w=800&q=80",
            "tartan_office_chair_white.jpg",
            "Tartan Executive Chair Chrome Base",
        ),
    ],
    # 19. Balcony Hanging Swing
    "Castara All-Weather Balcony Hanging Swing Chair with Heavy Duty Stand": [
        (
            "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=800&q=80",
            "castara_swing_chair.jpg",
            "Castara Teardrop Wicker Hanging Swing Chair with Stand",
        ),
    ],
    # Demo Retailer Products
    "Three-Seater Sofa": [
        (
            "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80",
            "three_seater_sofa.jpg",
            "Three-Seater Premium Fabric Sofa",
        ),
    ],
    "LED Panel Light 18W": [
        (
            "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=800&q=80",
            "led_panel_light_18w.jpg",
            "Philips AstraLine 18W LED Round Panel Light",
        ),
    ],
    "SS Screw M6×25": [
        (
            "https://images.unsplash.com/photo-1581783898377-1c85bf937427?auto=format&fit=crop&w=800&q=80",
            "ss_screw_m6_25.jpg",
            "Stainless Steel M6x25 Screws Box",
        ),
    ],
    "Wash Basin 550mm": [
        (
            "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80",
            "wash_basin_550mm.jpg",
            "Ceramic Tabletop Vanity Wash Basin 550mm",
        ),
    ],
}


async def seed_product_images():
    async with AsyncSessionLocal() as db:
        print("Seeding high quality product images across all products...")

        # Get all products
        res = await db.execute(select(Product))
        products = res.scalars().all()
        print(f"Found {len(products)} total products across tenants.")

        updated_count = 0
        for p in products:
            img_list = IMAGE_MAP.get(p.name)
            if not img_list:
                # Fallback to category-based or general furniture image
                img_list = [(
                    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80",
                    f"{p.name.lower().replace(' ', '_')}.jpg",
                    p.name,
                )]

            # Check existing images
            existing_imgs = (await db.execute(
                select(ProductImage).where(ProductImage.product_id == p.id)
            )).scalars().all()

            if existing_imgs:
                # Update existing first image URL
                existing_imgs[0].file_url = img_list[0][0]
                existing_imgs[0].caption = img_list[0][2]
                existing_imgs[0].is_primary = True
                updated_count += 1
                print(f"Updated image for: {p.name}")
            else:
                # Insert new images
                for idx, (url, fname, caption) in enumerate(img_list):
                    img = ProductImage(
                        tenant_id=p.tenant_id,
                        product_id=p.id,
                        file_url=url,
                        file_name=fname,
                        mime_type="image/jpeg",
                        caption=caption,
                        is_primary=(idx == 0),
                        sort_order=idx + 1,
                    )
                    db.add(img)
                updated_count += 1
                print(f"Added {len(img_list)} images for: {p.name}")

        await db.commit()
        print(f"\nSUCCESS! Configured images for {updated_count} products.")


if __name__ == "__main__":
    asyncio.run(seed_product_images())
