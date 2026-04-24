// Supabase configuration
const supabaseUrl = 'https://etfsjikbglxhqingzyri.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0ZnNqaWtiZ2x4aHFpbmd6eXJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NzA2ODcsImV4cCI6MjA5MjU0NjY4N30.PJkgG-Gj5nQNzULCuZv5GgE6Y-49_WAf9wF9ey9SVrc';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;

async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user || null;
    return currentUser;
}

async function loginUser(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });
    if (error) throw error;
    currentUser = data.user;
    return data.user;
}

async function registerUser(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
    });
    if (error) throw error;
    currentUser = data.user;
    return data.user;
}

async function logoutUser() {
    await supabase.auth.signOut();
    currentUser = null;
    // Clear local storage on logout for security
    localStorage.clear();
    location.reload();
}

// Data synchronization functions
async function fetchAppData() {
    if (!currentUser) return null;
    
    const { data, error } = await supabase
        .from('app_data')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();
        
    if (error && error.code !== 'PGRST116') { // PGRST116 is 'not found', which is fine for new users
        console.error("Error fetching app data:", error);
        return null;
    }
    
    return data; // Returns the row if it exists
}

async function saveAppData(columnName, jsonValue) {
    if (!currentUser) return;
    
    // First check if a row exists
    const { data: existingData } = await supabase
        .from('app_data')
        .select('user_id')
        .eq('user_id', currentUser.id)
        .single();

    if (existingData) {
        // Update existing row
        const { error } = await supabase
            .from('app_data')
            .update({ 
                [columnName]: jsonValue,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', currentUser.id);
        if (error) console.error("Error updating " + columnName, error);
    } else {
        // Insert new row
        const { error } = await supabase
            .from('app_data')
            .insert([{ 
                user_id: currentUser.id, 
                [columnName]: jsonValue 
            }]);
        if (error) console.error("Error inserting " + columnName, error);
    }
}

window.db = {
    supabase,
    checkUser,
    loginUser,
    registerUser,
    logoutUser,
    fetchAppData,
    saveAppData
};
