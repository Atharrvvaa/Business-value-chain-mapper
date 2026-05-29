import requests
from collections import defaultdict

r = requests.get('http://localhost:8000/mapping/results')
data = r.json()
print('=== MAPPING RESULTS ===')
for app in data:
    caps = [c['capability'] for c in app.get('mapped_capabilities', [])]
    print(f"{app['application_name']}: {caps}")

by_cap = defaultdict(list)
for app in data:
    for c in app.get('mapped_capabilities', []):
        by_cap[c['capability']].append(app['application_name'])

print('\n=== CAPS WITH 2+ APPS ===')
for cap, apps in sorted(by_cap.items(), key=lambda x: -len(x[1])):
    if len(apps) >= 2:
        print(f'{cap}: {apps}')
print(f'Total caps with 2+ apps: {sum(1 for apps in by_cap.values() if len(apps)>=2)}')

# Try redundancy endpoint
print('\n=== REDUNDANCY POST ===')
r2 = requests.post('http://localhost:8000/analytics/redundancy', timeout=120)
print('Status:', r2.status_code)
if r2.status_code == 200:
    rd = r2.json()
    print(f'Groups returned: {len(rd)}')
    for g in rd[:2]:
        print(g)
else:
    print('ERROR:', r2.text[:500])
