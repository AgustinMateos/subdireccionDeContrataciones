-- Resolución conv.: "Frenado" pasa a llamarse "Demorado". Idempotente.
-- El código acepta los dos nombres, así que se puede correr antes o después de subirlo.

-- Licitaciones
UPDATE "ExpedienteLicitacion" SET "resolucionConv" = 'Demorado' WHERE "resolucionConv" = 'Frenado';

-- Cuadro de Informática y Varios (bloques vigente, continuidad y renovación; provisiones)
UPDATE "FilaCuadroIyV" SET "datos" = jsonb_set("datos"::jsonb, '{resolucion}', '"Demorado"') WHERE "datos"->>'resolucion' = 'Frenado';
UPDATE "FilaCuadroIyV" SET "datos" = jsonb_set("datos"::jsonb, '{cResolucion}', '"Demorado"') WHERE "datos"->>'cResolucion' = 'Frenado';
UPDATE "FilaCuadroIyV" SET "datos" = jsonb_set("datos"::jsonb, '{rResolucion}', '"Demorado"') WHERE "datos"->>'rResolucion' = 'Frenado';
