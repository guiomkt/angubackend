require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_KEY são necessárias');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabase() {
  console.log('🚀 Configurando banco de dados...');

  try {
    // Ler e executar a migração da tabela users
    const usersMigrationPath = path.join(__dirname, '../supabase/migrations/20250101000000_create_users_table.sql');
    const usersMigration = fs.readFileSync(usersMigrationPath, 'utf8');

    console.log('📝 Executando migração da tabela users...');
    const { error: usersError } = await supabase.rpc('exec_sql', { sql: usersMigration });
    
    if (usersError) {
      console.error('❌ Erro ao criar tabela users:', usersError);
    } else {
      console.log('✅ Tabela users criada com sucesso');
    }

    // Verificar se a tabela restaurants existe
    const { data: restaurantsCheck, error: restaurantsCheckError } = await supabase
      .from('restaurants')
      .select('id')
      .limit(1);

    if (restaurantsCheckError) {
      console.log('⚠️  Tabela restaurants não encontrada. Criando...');
      
      // Criar tabela restaurants se não existir
      const createRestaurantsTable = `
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

        CREATE INDEX IF NOT EXISTS idx_restaurants_user_id ON restaurants(user_id);
        CREATE INDEX IF NOT EXISTS idx_restaurants_email ON restaurants(email);
      `;

      const { error: restaurantsError } = await supabase.rpc('exec_sql', { sql: createRestaurantsTable });
      
      if (restaurantsError) {
        console.error('❌ Erro ao criar tabela restaurants:', restaurantsError);
      } else {
        console.log('✅ Tabela restaurants criada com sucesso');
      }
    } else {
      console.log('✅ Tabela restaurants já existe');
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