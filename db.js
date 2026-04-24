// HTML'deki SDK'yı kullanarak bağlantı kuruyoruz
const supabaseUrl = 'https://etfsjikbglxhqingzyri.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0ZnNqaWtiZ2x4aHFpbmd6eXJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NzA2ODcsImV4cCI6MjA5MjU0NjY4N30.PJkgG-Gj5nQNzULCuZv5GgE6Y-49_WAf9wF9ey9SVrc';

// window.db objesini oluşturup içine fonksiyonları koyuyoruz
window.db = {
    // window.supabase.createClient'ı kullanıyoruz (HTML'den gelen)
    supabase: window.supabase.createClient(supabaseUrl, supabaseKey),
    
    checkUser: async function() {
        const { data: { session } } = await this.supabase.auth.getSession();
        return session?.user || null;
    },
    
    loginUser: async function(email, password) {
        const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data.user;
    },
    
    registerUser: async function(email, password) {
        const { data, error } = await this.supabase.auth.signUp({ email, password });
        if (error) throw error;
        return data.user;
    }
};