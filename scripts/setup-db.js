require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabase() {
  console.log('🚀 Configurando banco de dados...');

  try {
    // Executar migração para corrigir dependência circular
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250101000000_fix_circular_dependency.sql');
    
    if (fs.existsSync(migrationPath)) {
      console.log('📝 Executando migração para corrigir dependência circular...');
      const migration = fs.readFileSync(migrationPath, 'utf8');
      
      const { error: migrationError } = await supabase.rpc('exec_sql', { sql: migration });
      
      if (migrationError) {
        console.error('❌ Erro ao executar migração:', migrationError);
      } else {
        console.log('✅ Migração executada com sucesso');
      }
    } else {
      console.log('⚠️  Arquivo de migração não encontrado, criando estrutura básica...');
      
      // Criar estrutura básica se a migração não existir
      const createBasicStructure = `
        -- Criar tabela restaurants se não existir
        CREATE TABLE IF NOT EXISTS restaurants (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          user_id UUID NOT NULL,
          description TEXT,
          logo_url TEXT,
          address VARCHAR(200),
          city VARCHAR(100),
          state VARCHAR(50),
          postal_code VARCHAR(20),
          phone VARCHAR(20),
          email VARCHAR(100) NOT NULL,
          website VARCHAR(200),
          opening_hours JSONB,
          max_capacity INTEGER,
          onboarding_completed BOOLEAN DEFAULT FALSE,
          onboarding_step INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Criar tabela users se não existir (sem referência circular)
        CREATE TABLE IF NOT EXISTS users (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'owner',
          user_id UUID NOT NULL UNIQUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Criar índices
        CREATE INDEX IF NOT EXISTS idx_restaurants_user_id ON restaurants(user_id);
        CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
      `;

      const { error: structureError } = await supabase.rpc('exec_sql', { sql: createBasicStructure });
      
      if (structureError) {
        console.error('❌ Erro ao criar estrutura básica:', structureError);
      } else {
        console.log('✅ Estrutura básica criada com sucesso');
      }
    }

    console.log('🎉 Configuração do banco de dados concluída!');

  } catch (error) {
    console.error('❌ Erro durante a configuração:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase }; 