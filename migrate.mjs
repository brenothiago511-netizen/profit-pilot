import { createClient } from '@supabase/supabase-js'

// ─── BANCO ANTIGO (Lovable) ───────────────────────────────────────────────────
const OLD_URL = 'https://gyovaxenxtrogrxmbjde.supabase.co'
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b3ZheGVueHRyb2dyeG1iamRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0OTM5NzQsImV4cCI6MjA4MjA2OTk3NH0.juN8Ilhw9t1UdefZVsiLISnLweiOQ3fDzk8aDzQOCxI'
const OLD_EMAIL = 'admbrucewayne@pm.me'
const OLD_PASS = '280120'

// ─── BANCO NOVO ───────────────────────────────────────────────────────────────
const NEW_URL = 'https://pkrugmfapffjszkjhnir.supabase.co'
const NEW_KEY = 'sb_publishable_4x9rwMpJ6aJOHPgtx2sfAA_6Y3lK6zs'
const NEW_EMAIL = 'admbrucewayne@pm.me'
const NEW_PASS = '280120'

const oldDb = createClient(OLD_URL, OLD_KEY)
const newDb = createClient(NEW_URL, NEW_KEY)

async function migrate() {
  console.log('🔄 Iniciando migração v2...\n')

  // 1. Login
  const { data: oldAuth, error: oldErr } = await oldDb.auth.signInWithPassword({ email: OLD_EMAIL, password: OLD_PASS })
  if (oldErr) { console.error('❌ Erro banco antigo:', oldErr.message); process.exit(1) }
  const oldAdminId = oldAuth.user.id

  const { data: newAuth, error: newErr } = await newDb.auth.signInWithPassword({ email: NEW_EMAIL, password: NEW_PASS })
  if (newErr) { console.error('❌ Erro banco novo:', newErr.message); process.exit(1) }
  const newAdminId = newAuth.user.id

  console.log(`✅ Antigo admin: ${oldAdminId}`)
  console.log(`✅ Novo admin:   ${newAdminId}\n`)

  // 2. Mapear expense_categories (old ID -> new ID por nome)
  console.log('🗂️  Mapeando categorias de despesa...')
  const { data: oldCats } = await oldDb.from('expense_categories').select('*').limit(200)
  const { data: newCats } = await newDb.from('expense_categories').select('*').limit(200)
  const catMap = {}
  if (oldCats && newCats) {
    for (const oc of oldCats) {
      const nc = newCats.find(c => c.name === oc.name)
      if (nc) catMap[oc.id] = nc.id
    }
  }
  console.log(`   ${Object.keys(catMap).length} categorias mapeadas\n`)

  // 3. Mapear user IDs (buscar todos os profiles do banco antigo)
  console.log('👤 Buscando profiles do banco antigo...')
  const { data: oldProfiles } = await oldDb.from('profiles').select('*').limit(500)
  const userIdMap = {}
  userIdMap[oldAdminId] = newAdminId

  // Inserir profiles dos outros usuários no novo banco (mapeados para o novo admin como criador)
  if (oldProfiles) {
    const otherProfiles = oldProfiles.filter(p => p.id !== oldAdminId)
    console.log(`   ${oldProfiles.length} profiles encontrados (${otherProfiles.length} outros usuários)`)

    // Criar placeholder na tabela profiles para outros usuários não é possível sem criar auth.users
    // Então vamos mapear todos os outros user_ids para o novo admin
    for (const p of otherProfiles) {
      userIdMap[p.id] = newAdminId
    }
  }
  console.log()

  // Função para substituir user IDs em uma row
  const mapRow = (row) => {
    const r = { ...row }
    const userFields = ['user_id', 'created_by', 'updated_by', 'partner_user_id']
    for (const f of userFields) {
      if (r[f] && userIdMap[r[f]]) r[f] = userIdMap[r[f]]
    }
    // Mapear category_id em expenses
    if (r.category_id && catMap[r.category_id]) r.category_id = catMap[r.category_id]
    return r
  }

  // 4. Stores (já migradas mas re-fazer com upsert)
  await migrateTable('stores', oldDb, newDb, mapRow, 'id')

  // 5. Exchange rates
  await migrateTable('exchange_rates', oldDb, newDb, mapRow, 'id')

  // 6. Commission tiers
  await migrateTable('commission_tiers', oldDb, newDb, mapRow, 'id')

  // 7. Managers (sem user_id obrigatório se não existir no novo banco)
  console.log('📋 Migrando managers...')
  const { data: managers } = await oldDb.from('managers').select('*').limit(500)
  if (managers && managers.length > 0) {
    const mapped = managers.map(r => {
      const row = mapRow(r)
      return row
    })
    const { error } = await newDb.from('managers').upsert(mapped, { onConflict: 'id', ignoreDuplicates: true })
    if (error) console.log(`   ⚠️  ${error.message}`)
    else console.log(`   ✅ ${mapped.length} registros`)
  }

  // 8. Partners
  console.log('📋 Migrando partners...')
  const { data: partners } = await oldDb.from('partners').select('*').limit(500)
  if (partners && partners.length > 0) {
    const mapped = partners.map(mapRow)
    const { error } = await newDb.from('partners').upsert(mapped, { onConflict: 'id', ignoreDuplicates: true })
    if (error) console.log(`   ⚠️  ${error.message}`)
    else console.log(`   ✅ ${mapped.length} registros`)
  }

  // 9. Partner transactions
  console.log('📋 Migrando partner_transactions...')
  const { data: ptrans } = await oldDb.from('partner_transactions').select('*').limit(500)
  if (ptrans && ptrans.length > 0) {
    const mapped = ptrans.map(mapRow)
    const { error } = await newDb.from('partner_transactions').upsert(mapped, { onConflict: 'id', ignoreDuplicates: true })
    if (error) console.log(`   ⚠️  ${error.message}`)
    else console.log(`   ✅ ${mapped.length} registros`)
  }

  // 10. Revenues
  await migrateTable('revenues', oldDb, newDb, mapRow, 'id')

  // 11. Expenses
  await migrateTable('expenses', oldDb, newDb, mapRow, 'id')

  // 12. Daily records
  await migrateTable('daily_records', oldDb, newDb, mapRow, 'id')

  // 13. Profits & Commissions
  await migrateTable('profits', oldDb, newDb, mapRow, 'id')
  await migrateTable('commissions', oldDb, newDb, mapRow, 'id')

  // 14. Revenue goals
  await migrateTable('revenue_goals', oldDb, newDb, mapRow, 'id')

  // 15. Payroll
  console.log('📋 Migrando payroll...')
  const { data: payroll } = await oldDb.from('payroll').select('*').limit(500)
  if (payroll && payroll.length > 0) {
    const mapped = payroll.map(mapRow)
    const { error } = await newDb.from('payroll').upsert(mapped, { onConflict: 'id', ignoreDuplicates: true })
    if (error) console.log(`   ⚠️  ${error.message}`)
    else console.log(`   ✅ ${mapped.length} registros`)
  }

  // 16. Payroll payments
  await migrateTable('payroll_payments', oldDb, newDb, mapRow, 'id')

  // 17. Shopify withdrawals (já migradas)
  await migrateTable('shopify_withdrawals', oldDb, newDb, mapRow, 'id')

  console.log('\n✅ Migração v2 concluída!')
  console.log('🔍 Acesse: https://profit-pilot-w678.vercel.app')
}

async function fetchAll(db, table) {
  const PAGE = 1000
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await db.from(table).select('*').range(from, from + PAGE - 1)
    if (error) { console.log(`\n   ⚠️  Erro ao buscar ${table}: ${error.message}`); break }
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

async function migrateTable(table, oldDb, newDb, mapRow, conflict = 'id') {
  process.stdout.write(`📋 Migrando ${table}... `)
  const data = await fetchAll(oldDb, table)
  if (!data || data.length === 0) { console.log('0 registros'); return }

  const mapped = data.map(mapRow)
  let ok = 0
  for (let i = 0; i < mapped.length; i += 200) {
    const batch = mapped.slice(i, i + 200)
    const { error: e } = await newDb.from(table).upsert(batch, { onConflict: conflict, ignoreDuplicates: true })
    if (e) { console.log(`\n   ⚠️  ${e.message}`); return }
    ok += batch.length
  }
  console.log(`${ok}/${data.length} registros`)
}

migrate().catch(console.error)
