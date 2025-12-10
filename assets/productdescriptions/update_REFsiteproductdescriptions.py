#!/usr/bin/env python3
import urllib.request, os

SHEET_URL = "https://docs.google.com/spreadsheets/d/1ChEJHOebdtZLAgGKED-1c0kLeO6OvsthxqLEgJ0tXXM/export?format=csv&gid=0"
LOCAL_PATH = "/Users/penguinsenior/Documents/GitHub/refsite/assets/productdescriptions/REFsiteproductdescriptions.csv"

print("updating REFsiteproductdescriptions.csv...")
os.makedirs(os.path.dirname(LOCAL_PATH), exist_ok=True)
with urllib.request.urlopen(SHEET_URL) as r, open(LOCAL_PATH, "wb") as f:
    f.write(r.read())
print(f"updated: {LOCAL_PATH}")
