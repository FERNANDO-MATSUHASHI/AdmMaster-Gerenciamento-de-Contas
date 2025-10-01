-- Tornar o bucket público para permitir visualização direta
UPDATE storage.buckets 
SET public = true 
WHERE id = 'bill-attachments';

-- Adicionar política para leitura pública dos objetos
CREATE POLICY "Allow public read of bill attachments" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'bill-attachments');