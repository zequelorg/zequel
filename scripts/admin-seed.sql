-- Seed Website CMS tables from the original mock content.
-- Idempotent: only inserts when the table is empty (guards via NOT EXISTS).

-- Pages
INSERT INTO public.cms_pages (title, slug, status, seo_title, seo_description, sections, updated_by)
SELECT * FROM (VALUES
  ('Home','/','published','Zequel — AI Research Workspace','Synthesize literature, analyze documents, and accelerate research with Zequel.',7,'Elena Royce'),
  ('Features','/features','published','Features — Zequel','Everything Zequel offers for research teams.',5,'Marcus Vaughn'),
  ('Pricing','/pricing','published','Pricing — Zequel','Simple plans that scale with your research.',4,'Elena Royce'),
  ('About','/about','draft','About — Zequel','Our mission to accelerate human knowledge.',3,'Priya Nair'),
  ('Contact','/contact','published','Contact — Zequel','Get in touch with the Zequel team.',2,'Marcus Vaughn'),
  ('Changelog','/changelog','scheduled','Changelog — Zequel','What''s new in Zequel.',1,'Elena Royce')
) AS v(title,slug,status,seo_title,seo_description,sections,updated_by)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_pages);

-- Hero sections
INSERT INTO public.cms_hero_sections (page, eyebrow, headline, subhead, primary_cta_label, primary_cta_href, secondary_cta_label, secondary_cta_href, status)
SELECT * FROM (VALUES
  ('Home','AI research workspace','Research at the speed of thought','Zequel synthesizes thousands of sources, analyzes your documents, and surfaces citations you can trust.','Start free','/signup','Book a demo','/demo','published'),
  ('Features','Built for researchers','Every tool your investigation needs','From literature reviews to data synthesis, Zequel keeps your evidence organized and verifiable.','Explore features','/features','View pricing','/pricing','published'),
  ('Pricing','Simple pricing','Plans that scale with your work','Start free and upgrade as your research grows. No hidden fees.','Get started','/signup','Contact sales','/contact','draft')
) AS v(page,eyebrow,headline,subhead,primary_cta_label,primary_cta_href,secondary_cta_label,secondary_cta_href,status)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_hero_sections);

-- Feature items
INSERT INTO public.cms_feature_items (title, description, icon, group_name, sort_order, status)
SELECT * FROM (VALUES
  ('Literature synthesis','Summarize and cross-reference thousands of papers in seconds with verifiable citations.','BookOpen','Research',1,'published'),
  ('Document analysis','Upload PDFs, DOCX, and more — Zequel indexes and reasons over your private corpus.','FileSearch','Research',2,'published'),
  ('Trusted citations','Every claim links back to its source so you can verify and export with confidence.','Quote','Trust',3,'published'),
  ('Team workspaces','Share research threads, documents, and findings across your whole team.','Users','Collaboration',4,'published'),
  ('Developer API','Integrate Zequel synthesis directly into your own tools and pipelines.','Code','Platform',5,'draft')
) AS v(title,description,icon,group_name,sort_order,status)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_feature_items);

-- Pricing plans
INSERT INTO public.cms_pricing_plans (name, price_monthly, price_yearly, description, features, highlighted, cta_label, sort_order, status)
SELECT * FROM (VALUES
  ('Free',0,0,'For individuals getting started with AI research.','["50 AI requests / day","1 workspace","Community support","Basic citations"]'::jsonb,false,'Start free',1,'published'),
  ('Pro',29,290,'For power users and independent researchers.','["2,000 AI requests / day","Unlimited documents","Priority support","Citation export","Advanced models"]'::jsonb,true,'Upgrade to Pro',2,'published'),
  ('Team',99,990,'For research teams that collaborate.','["10,000 AI requests / day","12 seats included","Shared workspaces","Admin controls","SSO"]'::jsonb,false,'Start Team trial',3,'published'),
  ('Enterprise',0,0,'For organizations with custom needs.','["Unlimited usage","Dedicated support","Custom models","On-prem options","SLA & DPA"]'::jsonb,false,'Contact sales',4,'published')
) AS v(name,price_monthly,price_yearly,description,features,highlighted,cta_label,sort_order,status)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_pricing_plans);

-- Changelog
INSERT INTO public.cms_changelog_entries (version, title, type, body, status, released_at)
SELECT * FROM (VALUES
  ('2.9.0','Team workspaces and shared threads','feature','Invite your team, share research threads, and collaborate on document collections in real time.','published', NOW() - INTERVAL '2 days'),
  ('2.8.5','Faster document indexing','improvement','Indexing throughput improved by 40% for large PDF uploads.','published', NOW() - INTERVAL '11 days'),
  ('2.8.4','Fixed citation export formatting','fix','Resolved an issue where BibTeX exports dropped author middle initials.','published', NOW() - INTERVAL '18 days'),
  ('2.8.3','Session security hardening','security','Rotated signing keys and tightened session expiry for shared links.','published', NOW() - INTERVAL '25 days'),
  ('3.0.0-beta','New synthesis engine (beta)','feature','A rebuilt synthesis pipeline with deeper cross-document reasoning. Rolling out to beta users.','draft', NOW())
) AS v(version,title,type,body,status,released_at)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_changelog_entries);

-- FAQ
INSERT INTO public.cms_faq_items (question, answer, category, sort_order, status)
SELECT * FROM (VALUES
  ('What is Zequel?','Zequel is an AI research workspace that synthesizes literature and analyzes your documents.','General',1,'draft'),
  ('Is there a free plan?','Yes — the Free plan includes 50 AI requests per day and one workspace.','Billing',2,'published'),
  ('How are citations verified?','Every claim links back to its source document so you can verify provenance.','Privacy',3,'published'),
  ('Can I cancel anytime?','Yes, you can cancel or change your plan at any time from billing settings.','Technical',4,'published'),
  ('Is my data private?','Your documents are encrypted and never used to train shared models.','General',5,'published'),
  ('Do you offer SSO?','SSO is available on Team and Enterprise plans.','Billing',6,'published'),
  ('Which file types are supported?','PDF, DOCX, TXT, Markdown, and web pages are supported.','Privacy',7,'draft'),
  ('Do you have an API?','Yes, the developer API is available on Pro and above.','Technical',8,'published')
) AS v(question,answer,category,sort_order,status)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_faq_items);

-- Docs
INSERT INTO public.cms_doc_articles (title, slug, category, status, reading_minutes, sort_order, updated_by)
SELECT * FROM (VALUES
  ('Quickstart in 5 minutes','quickstart-in-5-minutes','Getting Started','draft',2,1,'Elena Royce'),
  ('Uploading and indexing documents','uploading-and-indexing-documents','Guides','published',5,2,'Marcus Vaughn'),
  ('Running your first synthesis','running-your-first-synthesis','API Reference','published',4,3,'Elena Royce'),
  ('Authentication & API keys','authentication-api-keys','Integrations','published',7,4,'Marcus Vaughn'),
  ('Webhooks reference','webhooks-reference','Troubleshooting','published',3,5,'Elena Royce'),
  ('Connecting Zotero','connecting-zotero','Getting Started','published',6,6,'Marcus Vaughn'),
  ('Exporting citations','exporting-citations','Guides','published',9,7,'Elena Royce'),
  ('Rate limits explained','rate-limits-explained','API Reference','draft',5,8,'Marcus Vaughn'),
  ('Managing team workspaces','managing-team-workspaces','Integrations','published',8,9,'Elena Royce'),
  ('Troubleshooting failed uploads','troubleshooting-failed-uploads','Troubleshooting','published',4,10,'Marcus Vaughn')
) AS v(title,slug,category,status,reading_minutes,sort_order,updated_by)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_doc_articles);

-- Blog
INSERT INTO public.cms_blog_posts (title, slug, excerpt, author, tags, status, published_at, views)
SELECT * FROM (VALUES
  ('How we built verifiable AI citations','how-we-built-verifiable-ai-citations','A closer look at the ideas and engineering behind Zequel''s research platform.','Elena Royce','["engineering","ai"]'::jsonb,'published', NOW() - INTERVAL '2 days', 4200),
  ('The state of AI in academic research 2026','the-state-of-ai-in-academic-research-2026','A closer look at the ideas and engineering behind Zequel''s research platform.','Marcus Vaughn','["research","industry"]'::jsonb,'published', NOW() - INTERVAL '8 days', 3100),
  ('Synthesis vs. summarization: what''s the difference','synthesis-vs-summarization-what-s-the-difference','A closer look at the ideas and engineering behind Zequel''s research platform.','Priya Nair','["product"]'::jsonb,'published', NOW() - INTERVAL '14 days', 5600),
  ('5 workflows to speed up your literature review','5-workflows-to-speed-up-your-literature-review','A closer look at the ideas and engineering behind Zequel''s research platform.','Elena Royce','["guides","productivity"]'::jsonb,'published', NOW() - INTERVAL '20 days', 2800),
  ('Introducing team workspaces','introducing-team-workspaces','A closer look at the ideas and engineering behind Zequel''s research platform.','Marcus Vaughn','["product","announcement"]'::jsonb,'scheduled', NULL, 0),
  ('Why provenance matters in AI research','why-provenance-matters-in-ai-research','A closer look at the ideas and engineering behind Zequel''s research platform.','Priya Nair','["trust","ai"]'::jsonb,'draft', NULL, 0)
) AS v(title,slug,excerpt,author,tags,status,published_at,views)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_blog_posts);

-- Contact messages
INSERT INTO public.cms_contact_messages (name, email, subject, message, status)
SELECT * FROM (VALUES
  ('Aiko Tanaka','aiko.tanaka@mail.com','Question about enterprise pricing','Hi team, I''d love to learn more about how Zequel could fit our research workflow. Could we set up a time to talk? Thanks!','new'),
  ('Leon Mercer','leon.mercer@mail.com','Partnership opportunity','Hi team, I''d love to learn more about how Zequel could fit our research workflow. Could we set up a time to talk? Thanks!','new'),
  ('Sara Holt','sara.holt@mail.com','Press inquiry','Hi team, I''d love to learn more about how Zequel could fit our research workflow. Could we set up a time to talk? Thanks!','read'),
  ('Devon Quist','devon.quist@mail.com','Help with my account','Hi team, I''d love to learn more about how Zequel could fit our research workflow. Could we set up a time to talk? Thanks!','replied'),
  ('Mara Bellini','mara.bellini@mail.com','Bulk licensing for university','Hi team, I''d love to learn more about how Zequel could fit our research workflow. Could we set up a time to talk? Thanks!','read'),
  ('Kojo Asante','kojo.asante@mail.com','Feedback on the product','Hi team, I''d love to learn more about how Zequel could fit our research workflow. Could we set up a time to talk? Thanks!','archived'),
  ('Ines Vega','ines.vega@mail.com','Integration question','Hi team, I''d love to learn more about how Zequel could fit our research workflow. Could we set up a time to talk? Thanks!','read'),
  ('Rafael Cruz','rafael.cruz@mail.com','Demo request','Hi team, I''d love to learn more about how Zequel could fit our research workflow. Could we set up a time to talk? Thanks!','read')
) AS v(name,email,subject,message,status)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_contact_messages);

-- Feature requests
INSERT INTO public.cms_feature_requests (title, description, requester, email, votes, status)
SELECT * FROM (VALUES
  ('Zotero two-way sync','A user-submitted idea to improve the Zequel research experience.','Aiko Tanaka','aiko.tanaka@mail.com',45,'open'),
  ('Dark mode for the reader','A user-submitted idea to improve the Zequel research experience.','Leon Mercer','leon.mercer@mail.com',82,'planned'),
  ('Bulk document upload via folder','A user-submitted idea to improve the Zequel research experience.','Sara Holt','sara.holt@mail.com',119,'in_progress'),
  ('Custom citation styles','A user-submitted idea to improve the Zequel research experience.','Devon Quist','devon.quist@mail.com',67,'shipped'),
  ('Slack notifications','A user-submitted idea to improve the Zequel research experience.','Mara Bellini','mara.bellini@mail.com',34,'declined'),
  ('Offline reading mode','A user-submitted idea to improve the Zequel research experience.','Kojo Asante','kojo.asante@mail.com',201,'open'),
  ('Export to Notion','A user-submitted idea to improve the Zequel research experience.','Ines Vega','ines.vega@mail.com',156,'planned'),
  ('Audio summaries of papers','A user-submitted idea to improve the Zequel research experience.','Rafael Cruz','rafael.cruz@mail.com',93,'in_progress')
) AS v(title,description,requester,email,votes,status)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_feature_requests);

-- CMS bug reports
INSERT INTO public.cms_bug_reports (title, description, reporter, email, severity, status, url)
SELECT * FROM (VALUES
  ('Synthesis spinner never stops on Safari','Steps to reproduce attached. Occurs consistently on the latest build.','Aiko Tanaka','aiko.tanaka@mail.com','low','new','/synthesis'),
  ('Citation export drops page numbers','Steps to reproduce attached. Occurs consistently on the latest build.','Devon Quist','devon.quist@mail.com','high','triaged','/export'),
  ('Search bar overlaps sidebar on mobile','Steps to reproduce attached. Occurs consistently on the latest build.','Ines Vega','ines.vega@mail.com','medium','in_progress','/'),
  ('PDF preview blank for scanned docs','Steps to reproduce attached. Occurs consistently on the latest build.','Aiko Tanaka','aiko.tanaka@mail.com','critical','resolved','/reader'),
  ('Login redirect loop after SSO','Steps to reproduce attached. Occurs consistently on the latest build.','Devon Quist','devon.quist@mail.com','low','wont_fix','/login'),
  ('Pricing toggle resets on resize','Steps to reproduce attached. Occurs consistently on the latest build.','Ines Vega','ines.vega@mail.com','medium','new','/pricing'),
  ('Markdown tables render misaligned','Steps to reproduce attached. Occurs consistently on the latest build.','Aiko Tanaka','aiko.tanaka@mail.com','high','triaged','/docs')
) AS v(title,description,reporter,email,severity,status,url)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_bug_reports);

-- Media assets
INSERT INTO public.cms_media_assets (name, type, url, size_kb, width, height, uploaded_by)
SELECT * FROM (VALUES
  ('hero-dashboard.png','image','/cms-media/hero-dashboard.png',842,1600,900,'Elena Royce'),
  ('feature-synthesis.png','image','/cms-media/feature-synthesis.png',412,1200,800,'Marcus Vaughn'),
  ('logo-mark.svg','icon','/cms-media/logo-mark.svg',6,NULL,NULL,'Elena Royce'),
  ('logo-wordmark.svg','icon','/cms-media/logo-wordmark.svg',9,NULL,NULL,'Marcus Vaughn'),
  ('pricing-bg.jpg','image','/cms-media/pricing-bg.jpg',1240,2000,1200,'Elena Royce'),
  ('product-tour.mp4','video','/cms-media/product-tour.mp4',18400,NULL,NULL,'Marcus Vaughn'),
  ('whitepaper-2026.pdf','document','/cms-media/whitepaper-2026.pdf',2280,NULL,NULL,'Elena Royce'),
  ('team-photo.jpg','image','/cms-media/team-photo.jpg',980,1600,1067,'Marcus Vaughn'),
  ('icon-citations.svg','icon','/cms-media/icon-citations.svg',4,NULL,NULL,'Elena Royce'),
  ('blog-cover-citations.png','image','/cms-media/blog-cover-citations.png',560,1200,630,'Marcus Vaughn'),
  ('og-default.png','image','/cms-media/og-default.png',320,1200,630,'Elena Royce'),
  ('demo-walkthrough.mp4','video','/cms-media/demo-walkthrough.mp4',24100,NULL,NULL,'Marcus Vaughn')
) AS v(name,type,url,size_kb,width,height,uploaded_by)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_media_assets);

-- Stats (home band + about values band)
INSERT INTO public.cms_stats (value, label, group_name, sort_order, status)
SELECT * FROM (VALUES
  ('92,418','Documents indexed','home',1,'published'),
  ('1.3M','Evidence-backed queries','home',2,'published'),
  ('612ms','Median response','home',3,'published'),
  ('99.98%','Uptime','home',4,'published'),
  ('2023','Founded','about',1,'published'),
  ('Remote','Team','about',2,'published'),
  ('Absalex Labs','Built by','about',3,'published'),
  ('Research-first','Mandate','about',4,'published')
) AS v(value,label,group_name,sort_order,status)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_stats);

-- How it works steps (home)
INSERT INTO public.cms_steps (step, title, body, sort_order, status)
SELECT * FROM (VALUES
  ('01','Bring your sources','Upload documents, papers, and notes — or connect a corpus. Zequel indexes everything into a searchable evidence base.',1,'published'),
  ('02','Ask in plain language','Pose questions the way you think about them. Zequel retrieves the relevant passages and reasons across them.',2,'published'),
  ('03','Get traceable answers','Receive synthesized conclusions with every claim cited back to its source — ready to verify, share, or build on.',3,'published')
) AS v(step,title,body,sort_order,status)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_steps);

-- Testimonials (home)
INSERT INTO public.cms_testimonials (quote, name, role, sort_order, status)
SELECT * FROM (VALUES
  ('Zequel changed how my lab handles literature reviews. Every synthesis comes with citations, so I can verify in seconds instead of hours.','Dr. Elena Royce','Principal Researcher, Computational Biology',1,'published'),
  ('The traceable reasoning is the killer feature. I can show reviewers exactly how a conclusion was reached, step by step.','Marcus Adeyemi','Policy Analyst',2,'published'),
  ('It feels like an instrument built for serious work — dense, fast, and honest about its sources. Nothing else comes close.','Priya Nair','Research Lead, Legal Tech',3,'published')
) AS v(quote,name,role,sort_order,status)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_testimonials);

-- Principles (about)
INSERT INTO public.cms_principles (title, body, sort_order, status)
SELECT * FROM (VALUES
  ('Evidence over assertion','A confident answer means nothing without a source. We hold every output to the standard of provable, citable evidence.',1,'published'),
  ('Transparency over magic','Research tools should show their work. We expose the full reasoning path so results can be inspected and reproduced.',2,'published'),
  ('Rigor over speed','We move fast, but never at the expense of correctness. Defensible conclusions are the only conclusions worth shipping.',3,'published'),
  ('Accountability over convenience','Serious research demands a record. Audit trails and governance are foundations, not afterthoughts.',4,'published')
) AS v(title,body,sort_order,status)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_principles);

-- Feature pillars (features page)
INSERT INTO public.cms_pillars (label, title, body, points, image, url, sort_order, status)
SELECT * FROM (VALUES
  ('Evidence','Answers grounded in your sources','Zequel reads across your entire corpus and reasons over it as a connected body of evidence. Every conclusion is assembled from passages you can open, read, and verify.','[{"icon":"FileSearch","text":"Ingest PDFs, papers, and notes at scale"},{"icon":"Quote","text":"Inline citations on every generated claim"},{"icon":"Database","text":"Searchable, persistent evidence base"}]'::jsonb,'/site/product-overview.png','zequel.xyz/workspace',1,'published'),
  ('Traceability','Reasoning you can follow end to end','Inspect the full chain from question to conclusion. Each inference is recorded so results are reproducible and reviewable — not a black box.','[{"icon":"GitBranch","text":"Step-by-step reasoning trails"},{"icon":"Gauge","text":"Live latency and request analytics"},{"icon":"Layers","text":"Structured threads and findings"}]'::jsonb,'/site/product-charts.png','zequel.xyz/workspace/overview',2,'published'),
  ('Governance','Accountable by design','Safety flags, audit logs, and role-based controls keep research defensible across individuals and teams. Know who did what, and why.','[{"icon":"ShieldCheck","text":"Automated safety and policy flags"},{"icon":"Users","text":"Role-based access and review queues"},{"icon":"Bell","text":"Full, immutable audit trail"}]'::jsonb,'/site/product-safety.png','zequel.xyz/workspace/safety',3,'published')
) AS v(label,title,body,points,image,url,sort_order,status)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_pillars);

-- About story (singleton)
INSERT INTO public.cms_about_story (body, status)
SELECT * FROM (VALUES
  (E'Most AI tools optimize for fluency. They produce text that sounds right, whether or not it is. For research — where a wrong conclusion has real consequences — that is not good enough.\n\nWe built Zequel as an instrument, not a chatbot. It reasons across the documents you trust, cites every claim it makes, and records the path from question to answer so you can verify each step. The point is not to replace the researcher, but to make rigorous work faster and more accountable.\n\nWe are a small, focused team at Absalex Labs, building for the people who cannot afford to be wrong.','published')
) AS v(body,status)
WHERE NOT EXISTS (SELECT 1 FROM public.cms_about_story);
