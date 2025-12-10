#!/usr/bin/env python3
import urllib.request, os

SHEET_URL = "https://docs.google.com/spreadsheets/d/1D60iEzPocS3x-Rb3b8Y0eefuyqXHTR0N802U5_6K95Y/export?format=csv&gid=0"
LOCAL_PATH = "/Users/penguinsenior/Documents/GitHub/refsite/assets/artdescriptions/REFsiteartdescriptions.csv"

print("updating REFsiteartdescriptions.csv...")
os.makedirs(os.path.dirname(LOCAL_PATH), exist_ok=True)
with urllib.request.urlopen(SHEET_URL) as r, open(LOCAL_PATH, "wb") as f:
    f.write(r.read())
print(f"updated: {LOCAL_PATH}")
