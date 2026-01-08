const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
    const { count, error } = await supabase.from('payments').select('*', { count: 'exact', head: true });
    console.log('Count:', count);
    if (error) console.error(error);
})();
