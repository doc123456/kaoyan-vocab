import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TraditionalStudy from './pages/TraditionalStudy';
import SentenceStudy from './pages/SentenceStudy';
import PhraseStudy from './pages/PhraseStudy';
import TestStudy from './pages/TestStudy';
import Navbar from './components/Navbar';
import AuthGate from './components/AuthGate';

function App() {
  return (
    <AuthGate>
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/traditional" element={<TraditionalStudy />} />
            <Route path="/sentence" element={<SentenceStudy />} />
            <Route path="/phrases" element={<PhraseStudy />} />
            <Route path="/test" element={<TestStudy />} />
          </Routes>
        </main>
      </div>
    </Router>
    </AuthGate>
  );
}

export default App;
