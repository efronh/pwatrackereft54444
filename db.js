const supabaseUrl = 'https://etfsjikbglxhqingzyri.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0ZnNqaWtiZ2x4aHFpbmd6eXJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NzA2ODcsImV4cCI6MjA5MjU0NjY4N30.PJkgG-Gj5nQNzULCuZv5GgE6Y-49_WAf9wF9ey9SVrc';

// Global Supabase istemcisi
const _supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

window.db = {
    supabase: _supabase,
    
    // Mevcut oturumu kontrol eder
    checkUser: async function() {
        const { data: { session } } = await _supabase.auth.getSession();
        return session?.user || null;
    },
    
    // Giriş yapma fonksiyonu
    loginUser: async function(email, password) {
        const { data, error } = await _supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (error) throw error;
        return data.user;
    },
    
    // Kayıt olma fonksiyonu
    registerUser: async function(email, password) {
        const { data, error } = await _supabase.auth.signUp({
            email: email,
            password: password
        });
        if (error) throw error;
        return data.user;
    }
};