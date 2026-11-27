from typing import Dict, List

MOBILE_TILES: List[Dict[str, str]] = [
    {
        "id": "dashboard",
        "label": "Dashboard",
        "description": "Quick KPIs and low-stock alerts",
    },
    {
        "id": "search",
        "label": "Product Search & Stock Check",
        "description": "Global search, prices, and multi-location stock",
    },
    {
        "id": "products",
        "label": "Products",
        "description": "Browse catalogue and product details",
    },
    {
        "id": "stock_maintenance",
        "label": "Stock Maintenance",
        "description": "Stock In, Stock Out, and adjustments",
    },
    {
        "id": "stock_transfers",
        "label": "Stock Transfers",
        "description": "Move stock between locations and godowns",
    },
    {
        "id": "supplier_orders",
        "label": "Supplier Orders",
        "description": "View and receive supplier purchase orders",
    },
]

MOBILE_TILE_IDS = [tile["id"] for tile in MOBILE_TILES]

MAX_PIN_FAILED_ATTEMPTS = 5
PIN_LOCKOUT_HOURS = 24


def normalize_mobile_pages(raw: object) -> Dict[str, bool]:
    """Return a complete {tile_id: bool} map for all supported mobile tiles."""
    source = raw if isinstance(raw, dict) else {}
    return {tile_id: bool(source.get(tile_id, False)) for tile_id in MOBILE_TILE_IDS}


def enabled_mobile_tiles(raw: object) -> List[str]:
    """Return ordered list of enabled tile IDs."""
    normalized = normalize_mobile_pages(raw)
    return [tile_id for tile_id in MOBILE_TILE_IDS if normalized.get(tile_id)]
