#!/usr/bin/env python3
"""Bundles every role into dist/preview.html (single file, role switcher on). Run: python3 build-preview.py"""
import os
R = os.path.dirname(os.path.abspath(__file__)); rd = lambda p: open(os.path.join(R, p), encoding='utf-8').read()
css = ''.join(rd('assets/'+f) for f in ['tokens.css','base.css','components.css'])
js_order = ['assets/config.js','assets/store.js','assets/ui.js','assets/router.js','assets/data/people.js','assets/data/jobs.js','assets/data/tasks.js','assets/data/mcps.js','assets/data/fleet.js','assets/data/org.js','assets/api.js','assets/shell.js',
  'org-admin/screens/setup.js','org-admin/screens/onboarding.js','org-admin/screens/requests.js','org-admin/screens/dashboard.js','org-admin/screens/map.js','org-admin/screens/performance.js',
  'user/screens/home.js','user/screens/new.js','user/screens/activity.js','fleet/screens/fleet.js','fleet/screens/office.js','fleet/screens/provision.js']
js = '\n'.join(rd(p) for p in js_order) + '\nShell.boot();'
html = f'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>ORBIT-OS preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>{css}</style></head><body><div id="app"></div><div id="layer"></div>
<script>window.ORBIT_PREVIEW = true;</script><script>{js}</script></body></html>'''
os.makedirs(os.path.join(R,'dist'), exist_ok=True); open(os.path.join(R,'dist','preview.html'),'w',encoding='utf-8').write(html); print('dist/preview.html', len(html)//1024, 'KB')
