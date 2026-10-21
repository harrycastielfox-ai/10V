-- NEXO - mantém o bucket de fontes privado e limita o tipo/tamanho dos arquivos.
update storage.buckets
set file_size_limit = 15728640,
    allowed_mime_types = array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]::text[]
where id = 'nexo-private';
