alter table public.academy_resources
  drop constraint if exists academy_resources_rights_status_check;

alter table public.academy_resources
  add constraint academy_resources_rights_status_check
  check (rights_status = any (array['original','licensed','public_domain','permission_pending','link_only']::text[]));

update public.academy_resources
set rights_status='link_only', is_published=true, updated_at=now()
where source_url in (
 'https://www.lefrancaisdesaffaires.fr/candidat/test-evaluation-francais/tef-canada/preparation/',
 'https://www.lefrancaisdesaffaires.fr/candidat/test-evaluation-francais/tef-canada/passation/',
 'https://www.france-education-international.fr/test/exemples-epreuves-tcf',
 'https://www.france-education-international.fr/test/tcf-canada',
 'https://www.lefrancaisdesaffaires.fr/wp-content/uploads/2024/10/tef-exemples-epreuves-co.pdf'
);