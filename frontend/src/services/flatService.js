// Flat Management Service - Handles storage and retrieval of flat information

const FLATS_STORAGE_KEY = 'society_flats_data';

// Get all flats from localStorage
export const getAllFlats = () => {
  try {
    const flatsData = localStorage.getItem(FLATS_STORAGE_KEY);
    return flatsData ? JSON.parse(flatsData) : [];
  } catch (error) {
    console.error('Error loading flats:', error);
    return [];
  }
};

// Get a specific flat by ID
export const getFlatById = (flatId) => {
  const flats = getAllFlats();
  return flats.find(flat => flat.id === flatId);
};

// Get flat by flat number and society
export const getFlatByNumber = (flatNumber, societyName) => {
  const flats = getAllFlats();
  return flats.find(
    flat => flat.flat_number === flatNumber && flat.society_name === societyName
  );
};

// Save a new flat
export const saveFlatInfo = (flatData) => {
  try {
    const flats = getAllFlats();
    
    // Check for duplicate
    const exists = flats.some(
      flat => flat.flat_number === flatData.flat_number && 
              flat.society_name === flatData.society_name
    );
    
    if (exists) {
      throw new Error('Flat already exists in this society');
    }
    
    const newFlat = {
      ...flatData,
      id: `flat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    flats.push(newFlat);
    localStorage.setItem(FLATS_STORAGE_KEY, JSON.stringify(flats));
    
    return newFlat;
  } catch (error) {
    console.error('Error saving flat:', error);
    throw error;
  }
};

// Update existing flat
export const updateFlatInfo = (flatId, updatedData) => {
  try {
    const flats = getAllFlats();
    const index = flats.findIndex(flat => flat.id === flatId);
    
    if (index === -1) {
      throw new Error('Flat not found');
    }
    
    flats[index] = {
      ...flats[index],
      ...updatedData,
      updated_at: new Date().toISOString()
    };
    
    localStorage.setItem(FLATS_STORAGE_KEY, JSON.stringify(flats));
    
    return flats[index];
  } catch (error) {
    console.error('Error updating flat:', error);
    throw error;
  }
};

// Delete a flat
export const deleteFlatInfo = (flatId) => {
  try {
    const flats = getAllFlats();
    const filteredFlats = flats.filter(flat => flat.id !== flatId);
    
    localStorage.setItem(FLATS_STORAGE_KEY, JSON.stringify(filteredFlats));
    
    return true;
  } catch (error) {
    console.error('Error deleting flat:', error);
    throw error;
  }
};

// Search flats
export const searchFlats = (searchTerm) => {
  const flats = getAllFlats();
  const term = searchTerm.toLowerCase();
  
  return flats.filter(flat => 
    flat.flat_number.toLowerCase().includes(term) ||
    flat.society_name.toLowerCase().includes(term) ||
    flat.member_name.toLowerCase().includes(term) ||
    flat.member_email.toLowerCase().includes(term)
  );
};

// Get flats by society
export const getFlatsBySociety = (societyName) => {
  const flats = getAllFlats();
  return flats.filter(flat => flat.society_name === societyName);
};

// Get unique societies
export const getAllSocieties = () => {
  const flats = getAllFlats();
  return [...new Set(flats.map(flat => flat.society_name))];
};

// Export all data (for backup)
export const exportFlatsData = () => {
  const flats = getAllFlats();
  const dataStr = JSON.stringify(flats, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `flats_backup_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
};

// Import data (for restore)
export const importFlatsData = (jsonData) => {
  try {
    const flats = JSON.parse(jsonData);
    
    if (!Array.isArray(flats)) {
      throw new Error('Invalid data format');
    }
    
    localStorage.setItem(FLATS_STORAGE_KEY, JSON.stringify(flats));
    
    return flats.length;
  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  }
};
