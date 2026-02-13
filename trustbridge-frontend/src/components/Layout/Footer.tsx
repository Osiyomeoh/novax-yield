import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Github, Twitter, Linkedin, Mail } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-blue to-primary-blue-light rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-sm">NY</span>
              </div>
              <span className="text-xl font-bold text-white">Novax Yield</span>
            </div>
            <p className="text-gray-400 mb-4 max-w-md">
              Real-world asset tokenization platform powered by Etherlink Network and IPFS. 
              Tokenize any asset, trade everything.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-white font-semibold mb-4">Platform</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/dashboard/marketplace" className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                  Marketplace
                </Link>
              </li>
              <li>
                <Link to="/dashboard/profile" className="text-gray-400 hover:text-primary-blue transition-colors">
                  Profile
                </Link>
              </li>
              <li>
                <Link to="/create-asset" className="text-gray-400 hover:text-primary-blue transition-colors">
                  Create Asset
                </Link>
              </li>
              <li>
                <Link to="/analytics" className="text-gray-400 hover:text-primary-blue transition-colors">
                  Analytics
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-4">Support</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/help" className="text-gray-400 hover:text-primary-blue transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/docs" className="text-gray-400 hover:text-primary-blue transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-gray-400 hover:text-primary-blue transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/status" className="text-gray-400 hover:text-primary-blue transition-colors">
                  System Status
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-1 text-gray-400 mb-4 md:mb-0">
            <span>© 2026 Novax Yield. Made with</span>
            <Heart className="w-4 h-4 text-red-500" />
            <span>for the future of asset tokenization.</span>
          </div>
          <div className="flex space-x-6 text-sm text-gray-400">
            <Link to="/privacy" className="hover:text-black dark:hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-primary-blue transition-colors">
              Terms of Service
            </Link>
            <Link to="/cookies" className="hover:text-primary-blue transition-colors">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

