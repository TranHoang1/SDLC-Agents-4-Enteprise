import urllib.request
import json

try:
    r = urllib.request.urlopen('http://127.0.0.1:9181/api/memory/graph/data?limit=5000')
    d = json.loads(r.read())
    print(f"nodes: {len(d.get('nodes', []))}, edges: {len(d.get('edges', []))}")
    if d.get('edges'):
        print("First 3 edges:", d['edges'][:3])
    if d.get('nodes'):
        print("First 3 nodes:", [{'id': n['id'], 'type': n['type']} for n in d['nodes'][:3]])
    if d.get('error'):
        print("Error:", d['error'])
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.reason}")
    body = e.read().decode('utf-8', errors='replace')
    print("Response body:", body[:2000])
except Exception as e:
    print(f"Error: {e}")
