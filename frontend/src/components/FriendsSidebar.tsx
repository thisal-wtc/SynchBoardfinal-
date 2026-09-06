import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Search, UserPlus, Check, X, User } from 'lucide-react';
import toast from 'react-hot-toast';

interface Friend {
  _id: string;
  name: string;
  email: string;
  avatar: string;
}

interface Request {
  _id: string;
  from: Friend;
  status: string;
}

const FriendsSidebar: React.FC = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchFriends = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/friends`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends || []);
        setRequests(data.friendRequests || []);
      }
    } catch (error) {
      console.error('Failed to fetch friends', error);
    }
  };

  useEffect(() => {
    fetchFriends();
    // In a real app, we could listen for socket events to update friends list
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/friends/search?query=${encodeURIComponent(searchQuery)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        setSearchResults(await response.json());
      }
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const sendRequest = async (targetUserId: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/friends/request`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ targetUserId })
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Failed to send request');
    }
  };

  const handleRequest = async (requestId: string, action: 'accepted' | 'rejected') => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/friends/respond`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ requestId, action })
      });
      if (response.ok) {
        toast.success(`Request ${action}`);
        fetchFriends(); // Refresh lists
      }
    } catch (error) {
      toast.error('Failed to process request');
    }
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Friends</h2>
        
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            placeholder="Find friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {searchQuery ? (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Search Results</h3>
            {isSearching ? (
              <p className="text-sm text-gray-500">Searching...</p>
            ) : searchResults.length > 0 ? (
              searchResults.map(result => (
                <div key={result._id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center">
                      {result.avatar ? <img src={result.avatar} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-gray-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{result.name || 'Unnamed'}</p>
                      <p className="text-xs text-gray-500">{result.email}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => sendRequest(result._id)}
                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-full"
                    title="Send Friend Request"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No users found.</p>
            )}
          </div>
        ) : (
          <>
            {requests.length > 0 && (
              <div className="mb-6 space-y-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Friend Requests ({requests.length})</h3>
                {requests.map(req => (
                  <div key={req._id} className="flex items-center justify-between p-2 bg-indigo-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-full overflow-hidden flex items-center justify-center">
                        {req.from.avatar ? <img src={req.from.avatar} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-gray-500" />}
                      </div>
                      <p className="text-sm font-medium text-gray-800">{req.from.name || req.from.email.split('@')[0]}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleRequest(req._id, 'accepted')} className="p-1 text-green-600 hover:bg-green-100 rounded">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleRequest(req._id, 'rejected')} className="p-1 text-red-600 hover:bg-red-100 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">My Friends ({friends.length})</h3>
              {friends.length === 0 ? (
                <p className="text-sm text-gray-500">You haven't added any friends yet.</p>
              ) : (
                friends.map(friend => (
                  <div key={friend._id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <div className="w-8 h-8 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center relative">
                      {friend.avatar ? <img src={friend.avatar} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-gray-500" />}
                      <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border border-white rounded-full"></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{friend.name || 'Unnamed'}</p>
                      <p className="text-xs text-gray-500 truncate w-40">{friend.email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FriendsSidebar;
