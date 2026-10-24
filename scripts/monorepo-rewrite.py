#!/usr/bin/env python3
"""Monorepo import rewriter. Run per-app: python3 rewrite.py <app_dir>"""
import re, sys, os, glob

app_dir = sys.argv[1]

# UI primitives that moved to @zequel/ui
def rewrite(src):
    # ---- shared package: supabase (keep subpath) ----
    src = re.sub(r'@/lib/supabase/([a-zA-Z0-9_-]+)', r'@zequel/shared/supabase/\1', src)
    src = re.sub(r'@/lib/supabase(?![/a-zA-Z])', r'@zequel/shared/supabase', src)
    # ---- shared package: security / settings / validation ----
    src = re.sub(r'@/lib/security/([a-zA-Z0-9_-]+)', r'@zequel/shared/security/\1', src)
    src = re.sub(r'@/lib/security(?![/a-zA-Z])', r'@zequel/shared/security', src)
    src = re.sub(r'@/lib/settings/([a-zA-Z0-9_-]+)', r'@zequel/shared/settings/\1', src)
    src = re.sub(r'@/lib/settings(?![/a-zA-Z])', r'@zequel/shared/settings', src)
    src = re.sub(r'@/lib/validation/([a-zA-Z0-9_-]+)', r'@zequel/shared/validation/\1', src)
    src = re.sub(r'@/lib/validation(?![/a-zA-Z])', r'@zequel/shared/validation', src)
    # ---- types package ----
    src = re.sub(r'@/lib/types(?![/a-zA-Z])', r'@zequel/types', src)
    # CMS contracts (admin-dashboard) -> types
    src = re.sub(r'@/lib/admin-dashboard/cms-types', r'@zequel/types', src)
    src = re.sub(r'@/lib/admin-dashboard/cms-schema', r'@zequel/types', src)
    # ---- ui package: ui primitives ----
    src = re.sub(r'@/components/ui/([a-zA-Z0-9_-]+)', r'@zequel/ui/components/\1', src)
    # brand/theme components shared via ui
    src = re.sub(r'@/components/(theme-provider|theme-toggle|zequel-logo|zequel-icon)', r'@zequel/ui/components/\1', src)
    # hooks -> ui
    src = re.sub(r'@/hooks/([a-zA-Z0-9_-]+)', r'@zequel/ui/hooks/\1', src)
    return src

count = 0
for f in glob.glob(os.path.join(app_dir, '**', '*.ts'), recursive=True) + \
         glob.glob(os.path.join(app_dir, '**', '*.tsx'), recursive=True):
    orig = open(f).read()
    new = rewrite(orig)
    if new != orig:
        open(f, 'w').write(new)
        count += 1
print(f"rewrote {count} files in {app_dir}")
