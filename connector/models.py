from pydantic import BaseModel, ConfigDict
from typing import Optional, Literal, Union
from datetime import datetime

class ProductSnapshot(BaseModel):
    url: str
    name: Optional[str] = None
    tcin: Optional[str] = None
    dpci: Optional[str] = None
    upc: Optional[str] = None
    price: Optional[float] = None
    in_stock: bool = False
    image_url: Optional[str] = None
    atc_url: Optional[str] = None
    purchase_limit: Optional[Union[str, int, float]] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class ChangeEvent(BaseModel):
    product_url: str
    tcin: Optional[str] = None
    event_type: Literal["RESTOCK", "OOS", "PRICE_CHANGE", "NEW_LISTING", "DETAIL_UPDATE"]
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    product_data: ProductSnapshot
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)
