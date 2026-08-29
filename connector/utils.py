import hashlib
import json
from typing import List, Optional
from .models import ProductSnapshot, ChangeEvent
from datetime import datetime

def compute_fingerprint(snapshot: ProductSnapshot) -> str:
    """Computes a hash of key fields to easily detect if a product state has changed."""
    data = {
        "price": snapshot.price,
        "in_stock": snapshot.in_stock,
        "name": snapshot.name,
        "dpci": snapshot.dpci,
        "upc": snapshot.upc,
        "purchase_limit": snapshot.purchase_limit
    }
    # Sort keys to ensure consistent hashing
    serialized = json.dumps(data, sort_keys=True)
    return hashlib.sha256(serialized.encode('utf-8')).hexdigest()

def diff_snapshots(old: Optional[ProductSnapshot], new: ProductSnapshot) -> List[ChangeEvent]:
    """Compares two snapshots and returns a list of ChangeEvents."""
    events = []
    
    if old is None:
        events.append(ChangeEvent(
            product_url=new.url,
            tcin=new.tcin,
            event_type="NEW_LISTING",
            old_value=None,
            new_value=new.name or "Unknown",
            product_data=new,
            timestamp=datetime.utcnow()
        ))
        return events

    if old.in_stock is False and new.in_stock is True:
        events.append(ChangeEvent(
            product_url=new.url,
            tcin=new.tcin,
            event_type="RESTOCK",
            old_value="False",
            new_value="True",
            product_data=new,
            timestamp=datetime.utcnow()
        ))
    elif old.in_stock is True and new.in_stock is False:
        events.append(ChangeEvent(
            product_url=new.url,
            tcin=new.tcin,
            event_type="OOS",
            old_value="True",
            new_value="False",
            product_data=new,
            timestamp=datetime.utcnow()
        ))
        
    if old.price != new.price and new.price is not None:
        events.append(ChangeEvent(
            product_url=new.url,
            tcin=new.tcin,
            event_type="PRICE_CHANGE",
            old_value=str(old.price) if old.price is not None else None,
            new_value=str(new.price),
            product_data=new,
            timestamp=datetime.utcnow()
        ))
        
    if (old.name != new.name and new.name) or (old.dpci != new.dpci and new.dpci) or (old.purchase_limit != new.purchase_limit and new.purchase_limit):
        events.append(ChangeEvent(
            product_url=new.url,
            tcin=new.tcin,
            event_type="DETAIL_UPDATE",
            old_value=None,
            new_value="Details updated",
            product_data=new,
            timestamp=datetime.utcnow()
        ))
        
    return events
