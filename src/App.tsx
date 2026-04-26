import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Calendar, Search, Bird, HelpCircle, ArrowRight, ArrowLeft, CheckCircle2, Loader2, Info } from 'lucide-react';
import { identifyBird, AIResponse, BirdResult } from './services/gemini';
import { WikipediaImage } from './components/WikipediaImage';
import { BirdAnatomyDiagram } from './components/BirdAnatomyDiagram';
import { SizeOption } from './components/SizeOption';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type Experience = 'pro' | 'amateur';

const SIZES = [
  "Sparrow-sized or smaller",
  "Between Sparrow and Robin",
  "Robin-sized",
  "Between Robin and Crow",
  "Crow-sized",
  "Between Crow and Goose",
  "Goose-sized"
];

const HABITATS = [
  "Forest or Woodland",
  "Ocean or Beach",
  "Lake, Pond, or River",
  "Marsh or Swamp",
  "Grassland or Prairie",
  "Desert or Scrub",
  "Urban or Suburban",
  "Agricultural or Farm",
  "Mountains or Alpine"
];

export default function App() {
  const [step, setStep] = useState<Step>(1);
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [experience, setExperience] = useState<Experience>('amateur');
  const [family, setFamily] = useState('');
  const [size, setSize] = useState('');
  const [behavior, setBehavior] = useState('');
  const [habitat, setHabitat] = useState('');
  const [colors, setColors] = useState('');
  const [qna, setQna] = useState<{ question: string; answer: string }[]>([]);
  const [expandedFamilies, setExpandedFamilies] = useState<string[]>([]);
  const [includeExpanded, setIncludeExpanded] = useState(false);
  const [showDebugTable, setShowDebugTable] = useState(false);
  
  const [ebirdUser, setEbirdUser] = useState('');
  const [ebirdPass, setEbirdPass] = useState('');
  const [showEbirdInfo, setShowEbirdInfo] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState('');

  const handleNext = () => setStep((s) => Math.min(s + 1, 8) as Step);
  const handlePrev = () => setStep((s) => Math.max(s - 1, 1) as Step);

  const handleEbirdSubmit = async () => {
    setIsProcessing(true);
    try {
      await fetch('/api/ebird-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ebirdUser, password: ebirdPass })
      });
      setStep(2);
    } catch (error) {
      console.error("Error saving eBird credentials:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitToAI = async () => {
    setIsProcessing(true);
    setStep(7);
    try {
      const response = await identifyBird(
        location,
        date,
        experience,
        family,
        size,
        behavior,
        habitat,
        colors,
        qna,
        includeExpanded ? expandedFamilies : undefined
      );
      setAiResponse(response);
      if (response.expandedFamilies) {
         setExpandedFamilies(response.expandedFamilies);
      }
      if (response.type === 'result') {
        setStep(8);
      }
    } catch (error) {
      console.error("Error identifying bird:", error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert("There was an error processing your request. Please try again.");
      }
      setStep(6); // Go back to last input step
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnswerQuestion = async () => {
    if (!aiResponse?.question || !currentAnswer.trim()) return;
    
    const newQna = [...qna, { question: aiResponse.question, answer: currentAnswer }];
    setQna(newQna);
    setCurrentAnswer('');
    
    setIsProcessing(true);
    try {
      const response = await identifyBird(
        location,
        date,
        experience,
        family,
        size,
        behavior,
        habitat,
        colors,
        newQna
      );
      setAiResponse(response);
      if (response.type === 'result') {
        setStep(8);
      }
    } catch (error) {
      console.error("Error identifying bird:", error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert("There was an error processing your answer. Please try again.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-3xl font-semibold text-stone-800 font-serif">eBird Integration</h2>
              <p className="text-stone-500 mt-2">Connect your eBird account to fetch local sightings data.</p>
            </div>
            
            <div className="space-y-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-stone-700">eBird Username</label>
                <button 
                  onClick={() => setShowEbirdInfo(!showEbirdInfo)} 
                  className="text-stone-400 hover:text-emerald-600 transition-colors" 
                  title="Why do we need this?"
                >
                  <HelpCircle className="h-5 w-5" />
                </button>
              </div>
              
              <AnimatePresence>
                {showEbirdInfo && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    exit={{ opacity: 0, height: 0 }} 
                    className="overflow-hidden"
                  >
                    <div className="bg-emerald-50 text-emerald-800 text-sm p-4 rounded-xl mb-4 border border-emerald-100">
                      <strong>Why do we need this?</strong> We log into your eBird account to download sightings probability bar chart data for your specific location and date. This allows us to accurately filter the possible birds you might have seen before using AI to narrow it down further.
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <input
                type="text"
                value={ebirdUser}
                onChange={(e) => setEbirdUser(e.target.value)}
                placeholder="Username"
                className="block w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-sm transition-shadow"
              />
              
              <label className="block text-sm font-medium text-stone-700 mt-4 mb-1">eBird Password</label>
              <input
                type="password"
                value={ebirdPass}
                onChange={(e) => setEbirdPass(e.target.value)}
                placeholder="Password"
                className="block w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-sm transition-shadow"
              />
            </div>

            <div className="flex justify-end pt-6">
              <button
                onClick={handleEbirdSubmit}
                disabled={!ebirdUser || !ebirdPass || isProcessing}
                className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? 'Connecting...' : 'Next Step'} <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-3xl font-semibold text-stone-800 font-serif">Where and When?</h2>
              <p className="text-stone-500 mt-2">Let's start with the basics of your sighting.</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Location</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-stone-400" />
                  </div>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Central Park, NY or 40.78, -73.96"
                    className="block w-full pl-10 pr-3 py-3 border border-stone-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-sm transition-shadow"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Date</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-stone-400" />
                  </div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-stone-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-sm transition-shadow"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-6">
              <button
                onClick={handleNext}
                disabled={!location || !date}
                className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next Step <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-3xl font-semibold text-stone-800 font-serif">Your Experience Level</h2>
              <p className="text-stone-500 mt-2">This helps us tailor the questions to your knowledge.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => { setExperience('amateur'); handleNext(); }}
                className={`p-6 border-2 rounded-2xl text-left transition-all ${experience === 'amateur' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 hover:border-emerald-300 hover:bg-stone-50'}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
                    <Search className="h-6 w-6" />
                  </div>
                  {experience === 'amateur' && <CheckCircle2 className="h-6 w-6 text-emerald-500" />}
                </div>
                <h3 className="text-lg font-semibold text-stone-800">Bird Enthusiast</h3>
                <p className="text-stone-500 text-sm mt-2">I'll describe the bird's size, behavior, and colors in my own words.</p>
              </button>
              
              <button
                onClick={() => { setExperience('pro'); handleNext(); }}
                className={`p-6 border-2 rounded-2xl text-left transition-all ${experience === 'pro' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 hover:border-emerald-300 hover:bg-stone-50'}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
                    <Bird className="h-6 w-6" />
                  </div>
                  {experience === 'pro' && <CheckCircle2 className="h-6 w-6 text-emerald-500" />}
                </div>
                <h3 className="text-lg font-semibold text-stone-800">Experienced Birder</h3>
                <p className="text-stone-500 text-sm mt-2">I can identify the likely bird family and skip basic questions.</p>
              </button>
            </div>

            <div className="flex justify-between pt-6">
              <button
                onClick={handlePrev}
                className="flex items-center px-6 py-3 text-stone-600 font-medium hover:text-stone-900 transition-colors"
              >
                <ArrowLeft className="mr-2 h-5 w-5" /> Back
              </button>
            </div>
          </motion.div>
        );
      case 4:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-3xl font-semibold text-stone-800 font-serif">Colors & Markings</h2>
              <p className="text-stone-500 mt-2">Describe the bird's plumage and any distinctive markings.</p>
            </div>
            
            <div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 flex items-start">
                <Info className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  Be as descriptive as possible. For example: "black eyebrow, white belly, orange legs, and blue back" or "white primary feathers, black secondary feathers".
                </p>
              </div>
              <textarea
                value={colors}
                onChange={(e) => setColors(e.target.value)}
                rows={5}
                placeholder="Describe the colors and where they were located..."
                className="block w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-sm resize-none"
              />
            </div>

            <div className="flex justify-between pt-6">
              <button
                onClick={handlePrev}
                className="flex items-center px-6 py-3 text-stone-600 font-medium hover:text-stone-900 transition-colors"
              >
                <ArrowLeft className="mr-2 h-5 w-5" /> Back
              </button>
              <button
                onClick={handleNext}
                disabled={!colors}
                className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next Step <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </div>
          </motion.div>
        );
      case 5:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-3xl font-semibold text-stone-800 font-serif">Habitat</h2>
              <p className="text-stone-500 mt-2">Where did you see the bird?</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {HABITATS.map((h) => (
                <button
                  key={h}
                  onClick={() => setHabitat(h)}
                  className={`px-4 py-4 text-sm rounded-xl border text-center transition-all ${habitat === h ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-medium shadow-sm' : 'border-stone-200 hover:border-stone-300 text-stone-700 bg-white'}`}
                >
                  {h}
                </button>
              ))}
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-stone-700 mb-1">Other (Optional)</label>
              <input
                type="text"
                value={!HABITATS.includes(habitat) && habitat ? habitat : ''}
                onChange={(e) => setHabitat(e.target.value)}
                placeholder="Describe the habitat if not listed above..."
                className="block w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-sm"
              />
            </div>

            <div className="flex justify-between pt-6">
              <button
                onClick={handlePrev}
                className="flex items-center px-6 py-3 text-stone-600 font-medium hover:text-stone-900 transition-colors"
              >
                <ArrowLeft className="mr-2 h-5 w-5" /> Back
              </button>
              <button
                onClick={handleNext}
                disabled={!habitat}
                className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next Step <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </div>
          </motion.div>
        );
      case 6:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {experience === 'pro' ? (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-semibold text-stone-800 font-serif">Bird Family & Behaviors</h2>
                  <p className="text-stone-500 mt-2">What family do you suspect this bird belongs to?</p>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Family or Possible Families</label>
                    <input
                      type="text"
                      value={family}
                      onChange={(e) => setFamily(e.target.value)}
                      placeholder="e.g., Anatidae, Parulidae, or just 'Sparrow'"
                      className="block w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Noted Behaviors (Optional)</label>
                    <textarea
                      value={behavior}
                      onChange={(e) => setBehavior(e.target.value)}
                      rows={3}
                      placeholder="Describe the behavior in your own words..."
                      className="block w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-sm resize-none"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-semibold text-stone-800 font-serif">Size & Behavior</h2>
                  <p className="text-stone-500 mt-2">Tell us about the bird's physical presence and actions.</p>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Approximate Size</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {SIZES.map((s) => (
                        <SizeOption 
                          key={s}
                          size={s}
                          selected={size === s}
                          onClick={() => setSize(s)}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Observed Behavior</label>
                    <p className="text-xs text-stone-500 mb-2">What was it doing? (e.g., foraging on the ground, soaring in circles, clinging to a tree trunk)</p>
                    <textarea
                      value={behavior}
                      onChange={(e) => setBehavior(e.target.value)}
                      rows={3}
                      placeholder="Describe the behavior in your own words..."
                      className="block w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-sm resize-none"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-between pt-6">
              <button
                onClick={handlePrev}
                className="flex items-center px-6 py-3 text-stone-600 font-medium hover:text-stone-900 transition-colors"
              >
                <ArrowLeft className="mr-2 h-5 w-5" /> Back
              </button>
              <button
                onClick={handleSubmitToAI}
                disabled={experience === 'pro' ? !family : (!size || !behavior) || isProcessing}
                className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? 'Processing...' : 'Identify Bird'} <Search className="ml-2 h-5 w-5" />
              </button>
            </div>
          </motion.div>
        );
      case 7:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 text-emerald-500 animate-spin mb-4" />
                <h2 className="text-2xl font-semibold text-stone-800 font-serif">Analyzing Data</h2>
                <p className="text-stone-500 mt-2 text-center max-w-md">
                  We are cross-referencing your observations with regional data and species characteristics...
                </p>
              </div>
            ) : aiResponse?.type === 'question' ? (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center p-3 bg-amber-100 text-amber-600 rounded-full mb-4">
                    <HelpCircle className="h-8 w-8" />
                  </div>
                  <h2 className="text-3xl font-semibold text-stone-800 font-serif">We need more info</h2>
                  <p className="text-stone-500 mt-2">There are still a few possibilities. Please answer this question to narrow it down.</p>
                </div>
                
                <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-xl font-medium text-stone-800 mb-4">{aiResponse.question}</h3>
                  
                  {aiResponse.anatomyTerm && (
                    <div className="mb-6 p-4 bg-stone-50 rounded-xl border border-stone-100">
                      <p className="text-sm text-stone-600 font-medium mb-4 flex items-center">
                        <Info className="h-4 w-4 mr-1.5 text-stone-400" />
                        What is a "{aiResponse.anatomyTerm}"?
                      </p>
                      <BirdAnatomyDiagram term={aiResponse.anatomyTerm} />
                    </div>
                  )}

                  <textarea
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    rows={3}
                    placeholder="Your answer..."
                    className="block w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-sm resize-none mb-4"
                  />
                  
                  <div className="flex justify-end">
                    <button
                      onClick={handleAnswerQuestion}
                      disabled={!currentAnswer.trim() || isProcessing}
                      className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Submit Answer <ArrowRight className="ml-2 h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        );
      case 8:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center p-3 bg-emerald-100 text-emerald-600 rounded-full mb-4">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-3xl font-semibold text-stone-800 font-serif">Identification Complete</h2>
              <p className="text-stone-500 mt-2">Based on your observations, here are the most likely matches.</p>
            </div>
            
            <div className="space-y-4">
              {aiResponse?.birds?.map((bird, index) => (
                <div key={index} className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-48 h-48 bg-stone-100 rounded-xl flex-shrink-0 overflow-hidden relative">
                    <WikipediaImage 
                      title={bird.scientificName} 
                      alt={bird.commonName}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-2xl font-semibold text-stone-800 font-serif">{bird.commonName}</h3>
                        <p className="text-stone-500 italic">{bird.scientificName}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        index === 0 ? 'bg-emerald-100 text-emerald-800' :
                        index === 1 ? 'bg-amber-100 text-amber-800' :
                        'bg-stone-100 text-stone-800'
                      }`}>
                        {index === 0 ? 'Top Match' : 'Possible Match'}
                      </span>
                    </div>
                    <p className="text-stone-600 mt-4 leading-relaxed mb-6">{bird.description}</p>
                    
                    {bird.ebirdCode && (
                      <a 
                        href={`https://ebird.org/species/${bird.ebirdCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors mb-6"
                      >
                        View on eBird <ArrowRight className="ml-1.5 h-4 w-4" />
                      </a>
                    )}
                    
                    {/* Bayesian Metrics */}
                    <div className="bg-stone-50 rounded-xl p-4 border border-stone-100 space-y-3">
                      <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Bayesian Probability</h4>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-stone-600">Prior <span className="text-stone-400">P(Species)</span></span>
                          <span className="font-medium text-stone-800">{(bird.prior * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-stone-200 rounded-full h-1.5">
                          <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${Math.min(bird.prior * 100, 100)}%` }}></div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-stone-600">Likelihood <span className="text-stone-400">P(Description|Species)</span></span>
                          <span className="font-medium text-stone-800">{(bird.likelihood * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-stone-200 rounded-full h-1.5">
                          <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${Math.min(bird.likelihood * 100, 100)}%` }}></div>
                        </div>
                      </div>

                      <div className="space-y-1 pt-2 border-t border-stone-200">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-stone-800">Posterior <span className="text-stone-500 font-normal text-xs">P(Species|Description)</span></span>
                          <span className="font-bold text-emerald-600">{((bird.posterior || 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-stone-200 rounded-full h-2">
                          <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min((bird.posterior || 0) * 100, 100)}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {experience === 'pro' && expandedFamilies.length > 0 && !includeExpanded && (
               <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm mt-8">
                  <h3 className="text-xl font-semibold text-stone-800 font-serif mb-2">See results with these families included?</h3>
                  <p className="text-sm text-stone-600 mb-4">The following families appear in this area and matched well with your physical description:</p>
                  <div className="flex flex-wrap gap-2 mb-6">
                     {expandedFamilies.map(fam => (
                        <span key={fam} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">{fam}</span>
                     ))}
                  </div>
                  <button
                     onClick={() => {
                        setIncludeExpanded(true);
                        setStep(6); // Send them back to step 6, but we need to show Amateur questions?
                        // Actually, if we just want to run the search again with amateur questions:
                        setExperience('amateur'); // Switch them to amateur temporarily to answer those questions
                        setStep(6); // Step 6 for amateur is Size & Behavior
                     }}
                     className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                  >
                     Add More Detail to Expand Search
                  </button>
               </div>
            )}

            <div className="flex justify-center pt-8 gap-4">
              <button
                onClick={() => setShowDebugTable(!showDebugTable)}
                className="px-6 py-3 border border-emerald-300 text-emerald-700 rounded-xl font-medium hover:bg-emerald-50 transition-colors"
              >
                {showDebugTable ? 'Hide Debug Data Table' : 'View Debug Data Table'}
              </button>
              <button
                onClick={() => {
                  setStep(2); // Skip eBird login since they already did it
                  setQna([]);
                  setAiResponse(null);
                  setLocation('');
                  setDate('');
                  setFamily('');
                  setSize('');
                  setBehavior('');
                  setHabitat('');
                  setColors('');
                  setCurrentAnswer('');
                  setShowDebugTable(false);
                }}
                className="px-6 py-3 border border-stone-300 text-stone-700 rounded-xl font-medium hover:bg-stone-50 transition-colors"
              >
                Start New Identification
              </button>
            </div>

            {showDebugTable && aiResponse?.allPoolBirds && (
              <div className="mt-8 bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
                  <h3 className="font-semibold text-stone-800">Debug Data Table (Master Pool)</h3>
                  {aiResponse.ebirdRegionCode && (
                    <div className="text-xs font-medium bg-stone-200 text-stone-700 px-2 py-1 rounded">
                      Region Matched: {aiResponse.ebirdRegionName} ({aiResponse.ebirdRegionCode})
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-stone-50 z-10 shadow-sm">
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 text-sm">
                      <th className="px-4 py-3 font-medium">Common Name</th>
                      <th className="px-4 py-3 font-medium">Scientific Name</th>
                      <th className="px-4 py-3 font-medium">Norm Freq (Prior)</th>
                      <th className="px-4 py-3 font-medium">Color (0-100)</th>
                      <th className="px-4 py-3 font-medium">Shape (0-100)</th>
                      <th className="px-4 py-3 font-medium">Behavior (0-100)</th>
                      <th className="px-4 py-3 font-medium">Likelihood</th>
                      <th className="px-4 py-3 font-medium">Posterior</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {aiResponse.allPoolBirds.map((bird, idx) => (
                      <tr key={idx} className="hover:bg-stone-50 text-sm">
                        <td className="px-4 py-3 font-medium text-stone-800">{bird.commonName}</td>
                        <td className="px-4 py-3 italic text-stone-500">{bird.scientificName}</td>
                        <td className="px-4 py-3">{bird.prior === -1 ? <span className="text-stone-400">Unavailable</span> : `${(bird.prior * 100).toFixed(2)}%`}</td>
                        <td className="px-4 py-3">{bird.colorScore !== undefined ? bird.colorScore.toFixed(0) : 'N/A'}</td>
                        <td className="px-4 py-3">{bird.shapeScore !== undefined ? bird.shapeScore.toFixed(0) : 'N/A'}</td>
                        <td className="px-4 py-3">{bird.behaviorScore !== undefined ? bird.behaviorScore.toFixed(0) : 'N/A'}</td>
                        <td className="px-4 py-3 text-amber-600">{(bird.likelihood * 100).toFixed(2)}%</td>
                        <td className="px-4 py-3 font-medium text-emerald-600">{((bird.posterior || 0) * 100).toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] font-sans text-stone-900 selection:bg-emerald-200 selection:text-emerald-900">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-700">
            <Bird className="h-6 w-6" />
            <span className="text-xl font-serif font-semibold tracking-tight">Avian ID</span>
          </div>
          {step < 7 && (
            <div className="flex items-center gap-1 text-sm font-medium text-stone-400">
              <span className={step >= 1 ? 'text-emerald-600' : ''}>1</span>
              <span className="mx-1">/</span>
              <span className={step >= 2 ? 'text-emerald-600' : ''}>2</span>
              <span className="mx-1">/</span>
              <span className={step >= 3 ? 'text-emerald-600' : ''}>3</span>
              <span className="mx-1">/</span>
              <span className={step >= 4 ? 'text-emerald-600' : ''}>4</span>
              <span className="mx-1">/</span>
              <span className={step >= 5 ? 'text-emerald-600' : ''}>5</span>
              <span className="mx-1">/</span>
              <span className={step >= 6 ? 'text-emerald-600' : ''}>6</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <AnimatePresence mode="wait">
          {renderStepContent()}
        </AnimatePresence>
      </main>
    </div>
  );
}
