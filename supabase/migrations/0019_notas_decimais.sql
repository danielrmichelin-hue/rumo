-- Provas e notas: a nota pode ter casas (7,5 de 10), não só acertos inteiros.
alter table public.study_mocks alter column total type numeric(8,2);
alter table public.study_mocks alter column correct type numeric(8,2);
