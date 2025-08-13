const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function debugUsers() {
  try {
    console.log('🔍 Verificando estrutura da tabela users...');
    
    // Verificar dados na tabela users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(5);
    
    if (usersError) {
      console.error('❌ Erro ao buscar usuários:', usersError);
      return;
    }
    
    console.log('👥 Usuários na tabela:');
    users.forEach(user => {
      console.log(`  - ID: ${user.id}, User ID: ${user.user_id}, Name: ${user.name}, Restaurant ID: ${user.restaurant_id}`);
    });
    
    // Verificar se há usuários com user_id
    const { data: usersWithUserId, error: usersWithUserIdError } = await supabase
      .from('users')
      .select('*')
      .not('user_id', 'is', null);
    
    if (usersWithUserIdError) {
      console.error('❌ Erro ao buscar usuários com user_id:', usersWithUserIdError);
      return;
    }
    
    console.log(`✅ Usuários com user_id preenchido: ${usersWithUserId.length}`);
    
    // Verificar tabela restaurants
    const { data: restaurants, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('*')
      .limit(5);
    
    if (restaurantsError) {
      console.error('❌ Erro ao buscar restaurantes:', restaurantsError);
      return;
    }
    
    console.log('🏪 Restaurantes na tabela:');
    restaurants.forEach(restaurant => {
      console.log(`  - ID: ${restaurant.id}, Name: ${restaurant.name}, User ID: ${restaurant.user_id}`);
    });
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugUsers(); 