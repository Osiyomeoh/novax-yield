import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import Button from '../components/UI/Button';
import { ArrowRight, TrendingUp, Shield, Globe, Users, Zap, Star, CheckCircle, MapPin, FileText, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import AnimatedBackground from '../components/UI/AnimatedBackground';
import AuthStatus from '../components/Auth/AuthStatus';

const Landing: React.FC = () => {
  console.log('Landing page rendered - user was redirected here');
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const heroSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (heroSectionRef.current) {
        const rect = heroSectionRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setMousePosition({ x, y });
      }
    };

    const heroSection = heroSectionRef.current;
    if (heroSection) {
      heroSection.addEventListener('mousemove', handleMouseMove);
      return () => {
        heroSection.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, []);
  const features = [
    {
      icon: Globe,
      title: 'Global Cross-Border Trading',
      description: 'Trade assets and receivables across all countries. Focus on Asia and Africa assets exposed to international markets. Borderless investment and liquidity.'
    },
    {
      icon: TrendingUp,
      title: 'Asia & Africa Asset Tokenization',
      description: 'Tokenize real-world assets from emerging markets - farms, real estate, commodities, infrastructure - making them accessible to global investors'
    },
    {
      icon: Receipt,
      title: 'Trade Receivables Financing',
      description: 'Tokenize invoices and trade receivables for immediate liquidity. Exporters get paid upfront while international investors earn yield'
    },
    {
      icon: Users,
      title: 'International Marketplace',
      description: 'Global peer-to-peer trading platform connecting Asia, Africa, and international markets with professional verification and immutable records'
    }
  ];

  const stats = [
    { label: 'Transaction Speed', value: '< 2 seconds', change: 'Etherlink L2' },
    { label: 'Transaction Cost', value: 'Low fees', change: 'Layer 2 scaling' },
    { label: 'Asset Types', value: 'Unlimited', change: 'Universal' },
    { label: 'Storage', value: 'IPFS', change: 'Decentralized' }
  ];

  const steps = [
    {
      number: '01',
      title: 'Connect & Browse',
      description: 'Connect your wallet and browse tokenized assets and trade receivables available for investment'
    },
    {
      number: '02',
      title: 'Submit Asset or Invoice',
      description: 'Submit your real-world asset (farm, property, commodity) or trade receivable (invoice) for professional verification'
    },
    {
      number: '03',
      title: 'Get Verified',
      description: 'AMC professionals verify and approve your asset or receivable for tokenization and pool creation'
    },
    {
      number: '04',
      title: 'Tokenize & Trade',
      description: 'Your asset or receivable is tokenized into a pool, and investors worldwide can purchase tokens representing ownership'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-black relative overflow-hidden">
      {/* Animated Background */}
      <AnimatedBackground />

      <div className="relative z-10">
        {/* Navigation */}
        <nav className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 bg-white/95 backdrop-blur-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black triangle floating"></div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-black">Novax Yield</h1>
              <p className="text-xs text-black uppercase tracking-wider">DeFi Platform</p>
            </div>
          </div>
          
          {/* Desktop Navigation Menu */}
          <div className="hidden lg:flex items-center gap-6 xl:gap-8">
            <a href="#assets" className="text-black hover:text-blue-600 transition-colors text-sm xl:text-base font-medium">Assets</a>
            <a href="#communities" className="text-black hover:text-blue-600 transition-colors text-sm xl:text-base font-medium">Communities</a>
            <a href="#features" className="text-black hover:text-blue-600 transition-colors text-sm xl:text-base font-medium">Features</a>
            <a href="#how-it-works" className="text-black hover:text-blue-600 transition-colors text-sm xl:text-base font-medium">How It Works</a>
            <Link to="/documentation">
              <span className="text-black hover:text-blue-600 transition-colors text-sm xl:text-base cursor-pointer font-medium">Docs</span>
            </Link>
            <Link to="/dashboard">
              <Button variant="neon" size="sm">Launch App</Button>
            </Link>
          </div>

          {/* Tablet Navigation */}
          <div className="hidden md:flex lg:hidden items-center gap-3">
            <Link to="/dashboard">
              <Button variant="neon" size="sm">Launch App</Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <Link to="/dashboard">
              <Button variant="neon" size="sm">Launch App</Button>
            </Link>
          </div>
        </nav>

        {/* Smooth Gradient Transition from Nav to Hero */}
        <div className="h-1 bg-gradient-to-b from-white via-white/50 to-transparent"></div>

        {/* Hero Section */}
        <section 
          ref={heroSectionRef}
          className="relative px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 min-h-screen flex items-center -mt-1"
        >
          {/* Hero Background Image */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            {/* Grayscale version - base layer (always visible) */}
            <img
              src="/images/countryside-people-out-field-together.jpg"
              alt="African farmers working together"
              className="w-full h-full object-cover grayscale contrast-110"
            />
            {/* Colorful version - revealed by mask where cursor is */}
            <div 
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{
                backgroundImage: 'url(/images/countryside-people-out-field-together.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'contrast(110%) saturate(1.2)',
                maskImage: `radial-gradient(circle 500px at ${mousePosition.x}% ${mousePosition.y}%, black 0%, black 60%, transparent 75%)`,
                WebkitMaskImage: `radial-gradient(circle 500px at ${mousePosition.x}% ${mousePosition.y}%, black 0%, black 60%, transparent 75%)`,
                mixBlendMode: 'normal',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white/85 via-white/65 to-white/45"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/50 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-transparent"></div>
            
            {/* Floating Elements */}
            <div className="absolute top-20 right-20 w-32 h-32 border border-black/10 rounded-full opacity-60 rotating"></div>
            <div className="absolute bottom-32 left-16 w-24 h-24 border border-black/10 rounded-full opacity-40 rotating" style={{ animationDirection: 'reverse' }}></div>
            <div className="absolute top-1/3 right-1/4 w-6 h-6 bg-black rounded-full opacity-70 floating"></div>
            <div className="absolute bottom-1/3 left-1/3 w-4 h-4 bg-black rounded-full opacity-60 floating" style={{ animationDelay: '2s' }}></div>
            <div className="absolute top-2/3 right-1/3 w-20 h-20 border border-black/10 morphing-shape opacity-30"></div>
          </div>
          
          <div className="relative z-10 max-w-7xl mx-auto w-full">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <motion.div
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-full mb-8 shadow-sm"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-700 uppercase tracking-wider">Live on Etherlink</span>
              </motion.div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold mb-6 sm:mb-8 leading-[1.1] tracking-tight">
                <motion.span 
                  className="block text-black mb-2"
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                >
                  GLOBAL TRADING
                </motion.span>
                <motion.span 
                  className="block text-blue-600 mb-2"
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                >
                  FOR ASIA & AFRICA
                </motion.span>
                <motion.span 
                  className="block text-black"
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                >
                  ASSETS
                </motion.span>
              </h1>

              <motion.p 
                className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-gray-800 max-w-4xl mx-auto mb-10 sm:mb-12 lg:mb-16 leading-relaxed px-4 font-light"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                The global trading platform connecting Asia and Africa to international markets. 
                <span className="text-black font-semibold"> Novax Yield</span> tokenizes real-world assets and trade receivables from emerging markets, making them accessible to investors worldwide.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.6 }}
              >
                <Link to="/dashboard">
                  <Button variant="primary" size="lg" className="group w-full sm:w-auto">
                    Launch App
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/dashboard/marketplace">
                  <Button variant="outline" size="lg" className="group w-full sm:w-auto">
                    Browse Assets
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </motion.div>
            </motion.div>

            {/* Live Stats */}
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-12 sm:mb-16 lg:mb-20 px-4"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  className="text-center p-4 sm:p-6 bg-white/80 backdrop-blur-md rounded-xl border border-gray-200 hover:border-gray-300 transition-all duration-300 hover:scale-105"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 + index * 0.1, duration: 0.5 }}
                >
                  <h3 className="text-2xl sm:text-3xl font-bold text-black mb-1 sm:mb-2">{stat.value}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">{stat.label}</p>
                  <p className="text-xs text-black font-semibold">{stat.change}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Assets & Receivables Showcase */}
        <section id="assets" className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 bg-gray-50 relative z-10">
          <div className="max-w-7xl mx-auto">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold mb-6 sm:mb-8 leading-tight tracking-tight">
                <span className="text-black">ASIA & AFRICA ASSETS</span>
                <br />
                <span className="text-blue-600">FOR GLOBAL MARKETS</span>
              </h2>
              <p className="text-xl sm:text-2xl text-gray-800 max-w-3xl mx-auto px-4 leading-relaxed font-light">
                Discover tokenized assets and trade receivables from Asia and Africa, now accessible to international investors. Cross-border trading platform connecting emerging markets with global capital.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {[
                {
                  title: 'Rice Farm - Vietnam',
                  location: 'Mekong Delta, Vietnam',
                  value: '$3.2M',
                  image: '/images/1.jpg',
                  type: 'Agriculture',
                  tokenized: true,
                  investors: 52
                },
                {
                  title: 'Manufacturing Facility - Thailand',
                  location: 'Bangkok Industrial Zone, Thailand',
                  value: '$6.5M',
                  image: '/images/2.jpg',
                  type: 'Infrastructure',
                  tokenized: true,
                  investors: 94
                },
                {
                  title: 'Commercial Complex - Singapore',
                  location: 'Marina Bay, Singapore',
                  value: '$15.8M',
                  image: '/images/3.jpg',
                  type: 'Real Estate',
                  tokenized: true,
                  investors: 187
                },
                {
                  title: 'Trade Receivable Pool',
                  location: 'Asia & Africa',
                  value: '$9.4M',
                  image: '/images/4.jpg',
                  type: 'Trade Receivables',
                  tokenized: true,
                  investors: 142
                }
              ].map((asset, index) => (
                <motion.div
                  key={asset.title}
                  className="group cursor-pointer"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1, duration: 0.6 }}
                  whileHover={{ y: -5 }}
                >
                  <div className="relative overflow-hidden rounded-xl bg-white border-2 border-gray-200 hover:border-blue-300 transition-all duration-300 transform hover:-translate-y-2 shadow-md hover:shadow-xl">
                    {/* Image */}
                    <div className="aspect-video relative overflow-hidden">
                      <img
                        src={asset.image}
                        alt={asset.title}
                        className="w-full h-full object-cover object-center group-hover:scale-110 transition-all duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {/* Type Badge */}
                      <div className="absolute top-3 left-3 z-10">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/95 backdrop-blur-sm text-gray-900 border border-gray-200 shadow-sm">
                          <span className="text-base">
                            {asset.type === 'Agriculture' ? '🌾' : 
                             asset.type === 'Real Estate' ? '🏢' : 
                             asset.type === 'Infrastructure' ? '⚡' : 
                             asset.type === 'Trade Receivables' ? '📄' : '📦'}
                          </span>
                          {asset.type}
                        </span>
                      </div>

                      {/* Tokenized Badge */}
                      {asset.tokenized && (
                        <div className="absolute top-3 right-3 z-10">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white border-2 border-green-400 shadow-lg">
                            <Shield className="w-3.5 h-3.5" />
                            Tokenized
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-5 bg-white">
                      <h3 className="text-lg font-bold text-black mb-3 group-hover:text-blue-600 transition-colors">
                        {asset.title}
                      </h3>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <span className="font-medium">{asset.location}</span>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div className="text-2xl font-extrabold text-blue-600">
                          {asset.value}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded-full">
                          <Users className="w-4 h-4 text-blue-600" />
                          <span className="font-semibold">{asset.investors}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              className="text-center mt-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              <Link to="/dashboard/assets">
                <Button variant="outline" size="lg" className="group">
                  View All Assets
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* African Communities Section */}
        <section id="communities" className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 bg-white relative">
          {/* Section Separator - Smooth gradient */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
          
          <div className="relative z-10 max-w-7xl mx-auto">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
                <span className="text-black">CONNECTING</span>
                <br />
                <span className="text-blue-600">ASIA & AFRICA TO GLOBAL MARKETS</span>
              </h2>
              <p className="text-xl sm:text-2xl text-gray-800 max-w-3xl mx-auto leading-relaxed font-light">
                Real people, real stories. See how Novax Yield is connecting Asia and Africa to international markets, transforming local assets into global investment opportunities.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  name: 'Li Wei',
                  role: 'Manufacturing Executive',
                  location: 'Shanghai, China',
                  story: 'Tokenized our manufacturing facility and connected with international investors across 30+ countries.',
                  image: '/images/1.jpg',
                  value: '$4.8M'
                },
                {
                  name: 'Priya Sharma',
                  role: 'Real Estate Developer',
                  location: 'Mumbai, India',
                  story: 'Our commercial complex in Mumbai is now accessible to global investors, unlocking new capital for expansion.',
                  image: '/images/2.jpg',
                  value: '$12.3M'
                },
                {
                  name: 'Kenji Tanaka',
                  role: 'Agricultural Producer',
                  location: 'Osaka, Japan',
                  story: 'Tokenized our rice production facility and now have investors from Asia, Africa, and Europe supporting growth.',
                  image: '/images/3.jpg',
                  value: '$7.6M'
                }
              ].map((person, index) => (
                <motion.div
                  key={person.name}
                  className="group"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1, duration: 0.6 }}
                >
                  <div className="relative overflow-hidden rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-all duration-300 shadow-lg transform hover:-translate-y-1">
                    {/* Image */}
                    <div className="aspect-square relative overflow-hidden">
                      <img
                        src={person.image}
                        alt={person.name}
                        className="w-full h-full object-cover object-center group-hover:scale-110 transition-all duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {/* Value Badge */}
                      <div className="absolute top-3 right-3 z-10">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-2 border-blue-400 shadow-lg">
                          {person.value}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 bg-white">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{person.name}</h3>
                      <p className="text-blue-600 font-semibold mb-2">{person.role}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <span className="font-medium">{person.location}</span>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed italic">
                        "{person.story}"
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Trade Receivables Section */}
        <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 bg-white relative z-10">
          <div className="max-w-7xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-full mb-6 shadow-sm">
                <Receipt className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-semibold text-blue-700 uppercase tracking-wider">New Feature</span>
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
                <span className="text-black">TRADE RECEIVABLES</span>
                <br />
                <span className="text-blue-600">FINANCING</span>
              </h2>
              <p className="text-xl sm:text-2xl text-gray-800 max-w-3xl mx-auto px-4 leading-relaxed font-light">
                Get immediate liquidity for your invoices. Exporters can tokenize trade receivables and receive upfront payment while investors earn yield from verified invoices.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              {[
                {
                  icon: FileText,
                  title: 'Create Invoice Receivable',
                  description: 'Upload your invoice and create a trade receivable on the blockchain. Documents are stored securely on IPFS.'
                },
                {
                  icon: CheckCircle,
                  title: 'AMC Verification',
                  description: 'Professional AMC verifies your invoice and assigns a risk score. Verified receivables can be added to investment pools.'
                },
                {
                  icon: TrendingUp,
                  title: 'Get Liquidity & Earn Yield',
                  description: 'Exporters receive immediate payment while investors earn yield from verified trade receivables in pools.'
                }
              ].map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-blue-300 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.1, duration: 0.6 }}
                  >
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mb-4 shadow-md">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                    <p className="text-gray-700 leading-relaxed">{feature.description}</p>
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <Link to="/dashboard">
                <Button variant="primary" size="lg" className="group">
                  <FileText className="w-5 h-5 mr-2" />
                  Create Trade Receivable
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
                <span className="text-black">WHY</span>
                <span className="text-blue-600"> NOVAX YIELD</span>
              </h2>
              <p className="text-xl sm:text-2xl text-gray-800 max-w-3xl mx-auto leading-relaxed font-light">
                We're building the global trading platform that connects Asia and Africa to international markets. Professional verification, cross-border liquidity, and worldwide investment access.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    className="text-center p-6 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-300 transition-all duration-300 hover:scale-105 hover:shadow-lg"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.1, duration: 0.6 }}
                  >
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                    <p className="text-gray-700 leading-relaxed">{feature.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="max-w-7xl mx-auto">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
                <span className="text-black">HOW IT</span>
                <span className="text-blue-600"> WORKS</span>
              </h2>
              <p className="text-xl sm:text-2xl text-gray-800 max-w-3xl mx-auto leading-relaxed font-light">
                From listing your Asia or Africa asset to international investment in four simple steps.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {steps.map((step, index) => (
                <motion.div
                  key={step.number}
                  className="text-center"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1, duration: 0.6 }}
                >
                  <div className="relative mb-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center mx-auto shadow-lg">
                      <span className="text-2xl font-bold text-white">{step.number}</span>
                    </div>
                    {index < steps.length - 1 && (
                      <div className="hidden lg:block absolute top-10 left-full w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600 transform translate-x-4"></div>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                  <p className="text-gray-700 leading-relaxed">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
                <span className="text-black">READY TO</span>
                <br />
                <span className="text-blue-600">LAUNCH APP</span>
              </h2>
              <p className="text-xl sm:text-2xl text-gray-800 mb-12 leading-relaxed font-light">
                Join the global trading platform connecting Asia and Africa to international markets. Start investing worldwide or list your asset for global access.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/dashboard">
                  <Button variant="primary" size="lg" className="group">
                    <Zap className="w-5 h-5 mr-2" />
                    Start Investing
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Button variant="outline" size="lg" className="group">
                  <Users className="w-5 h-5 mr-2" />
                  List Your Asset
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 bg-gray-50 border-t border-gray-200">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-black triangle floating"></div>
                  <div>
                    <h3 className="text-lg font-bold text-black">Novax Yield</h3>
                    <p className="text-xs text-gray-600 uppercase tracking-wider">DeFi Platform</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Global trading platform connecting Asia and Africa to international markets. Tokenizing assets and receivables for cross-border investment and liquidity.
                </p>
              </div>

              <div className="flex flex-col">
                <h4 className="text-sm font-bold text-black mb-4 uppercase tracking-wider">Resources</h4>
                <ul className="space-y-2.5">
                  <li>
                    <Link to="/documentation" className="text-sm text-gray-700 hover:text-blue-600 transition-colors font-medium">
                      Documentation
                    </Link>
                  </li>
                  <li>
                    <a href="https://hashscan.io/testnet" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 hover:text-blue-600 transition-colors font-medium">
                      Block Explorer
                    </a>
                  </li>
                  <li>
                    <a href="https://etherlink.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 hover:text-blue-600 transition-colors font-medium">
                      About Etherlink
                    </a>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col">
                <h4 className="text-sm font-bold text-black mb-4 uppercase tracking-wider">Launch App</h4>
                <ul className="space-y-2.5">
                  <li>
                    <Link to="/marketplace" className="text-sm text-gray-700 hover:text-blue-600 transition-colors font-medium">
                      Connect Wallet
                    </Link>
                  </li>
                  <li>
                    <Link to="/exchange" className="text-sm text-gray-700 hover:text-blue-600 transition-colors font-medium">
                      Get Test Tokens
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between pt-6 border-t border-gray-200">
              <span className="text-sm text-gray-600 mb-2 md:mb-0">© 2026 Novax Yield</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-700 font-medium">Live on Etherlink</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
