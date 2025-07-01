import React from 'react';

const Debug = () => {
  console.log('Debug component rendered');
  
  // Check environment variables
  console.log('Environment variables:', {
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Page</h1>
      <div className="bg-gray-100 p-4 rounded">
        <p>React is working!</p>
        <p>API Key: {import.meta.env.VITE_FIREBASE_API_KEY ? 'Found' : 'Missing'}</p>
        <p>Auth Domain: {import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? 'Found' : 'Missing'}</p>
        <p>Project ID: {import.meta.env.VITE_FIREBASE_PROJECT_ID ? 'Found' : 'Missing'}</p>
      </div>
    </div>
  );
};

export default Debug;
