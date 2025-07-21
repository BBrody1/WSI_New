import pandas as pd
import time
import os
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

# --- LOAD ENV VARIABLES FROM .env ---
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# --- CONFIG ---
CSV_FILE = os.path.expanduser("~/Documents/WorkSafetyIndex/Raw_Files/ITA Case Data 2024.csv")
TABLE_NAME = "case_details"
CHUNK_SIZE = 1000

# --- INIT SUPABASE CLIENT ---
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- LOAD CSV (Preserve All Text) ---
df = pd.read_csv(CSV_FILE, dtype=str, encoding='ISO-8859-1')
df = df.where(df.notnull(), None)
df = df.replace('', None)

df.columns = df.columns.str.lower()

def parse_ita_timestamp(ts):
    try:
        return datetime.strptime(ts, "%d%b%y:%H:%M:%S").isoformat(sep=' ')
    except:
        return None

column_rename_map = {
    "id": "osha_id",
    "new_incident_location": "incident_location",
    "new_incident_description": "incident_description",
    "new_nar_before_incident": "narrative_before_incident",
    "new_nar_what_happened": "narrative_what_happened",
    "new_nar_injury_illness": "narrative_injury_illness",
    "new_nar_object_substance": "narrative_object_substance",
    "soc_code": "soc_code",
    "soc_description": "soc_description",
    "soc_probability": "soc_probability",
    "soc_reviewed": "soc_reviewed"
}

# --- Rename columns from OSHA schema to DB schema ---
df.rename(columns=column_rename_map, inplace=True)

if "created_timestamp" in df.columns:
    df["created_timestamp"] = df["created_timestamp"].apply(lambda x: parse_ita_timestamp(x) if x else None)

# --- CLEAN: Strip ".00" from any numeric-looking string values ---
for col in df.columns:
    df[col] = df[col].str.replace(r"\.00$", "", regex=True)

# --- CHUNKED UPLOAD ---
chunks = [df[i:i+CHUNK_SIZE] for i in range(0, len(df), CHUNK_SIZE)]

for i, chunk in enumerate(chunks):
    data = chunk.to_dict(orient="records")
    try:
        supabase.table(TABLE_NAME).insert(data).execute()
        print(f"✅ Chunk {i+1}/{len(chunks)} inserted.")
    except Exception as e:
        print(f"❌ Error inserting chunk {i+1}: {e}")
    time.sleep(0.5)