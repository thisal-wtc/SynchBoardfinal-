import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FriendsSidebar from './FriendsSidebar';
import { Users, Plus, Settings as SettingsIcon, Layout, LogOut, User } from 'lucide-react';
import toast from 'react-hot-toast';

interface Room {
  _id: string;
  name: string;
  description: string;
  members: { _id: string, name: string, avatar: string }[];
}

const Dashboard: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');

  const fetchRooms = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/rooms`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        setRooms(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch rooms', error);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/rooms/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name: newRoomName, description: newRoomDesc })
      });
      if (response.ok) {
        toast.success('Room created!');
        setIsCreatingRoom(false);
        setNewRoomName('');
        setNewRoomDesc('');
        fetchRooms();
      }
    } catch (error) {
      toast.error('Failed to create room');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-inter">
      {/* Sidebar for Navigation / Friends */}
      <div className="w-20 lg:w-64 bg-gray-900 text-white flex flex-col justify-between shrink-0">
        <div>
          <div className="p-4 lg:p-6 flex items-center justify-center lg:justify-start gap-3 border-b border-gray-800">
            <Layout className="w-8 h-8 text-indigo-400" />
            <h1 className="text-xl font-bold tracking-tight hidden lg:block">SynchBoard</h1>
          </div>
          
          <nav className="mt-8 px-2 lg:px-4 space-y-2">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 bg-indigo-600 rounded-lg text-white font-medium transition-colors">
              <Layout className="w-5 h-5" />
              <span className="hidden lg:block">Dashboard</span>
            </button>
            <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition-colors font-medium">
              <SettingsIcon className="w-5 h-5" />
              <span className="hidden lg:block">Settings</span>
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-gray-800">
          <button onClick={logout} className="w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 hover:bg-red-500/10 hover:text-red-400 text-gray-400 rounded-lg transition-colors font-medium">
            <LogOut className="w-5 h-5" />
            <span className="hidden lg:block">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            <header className="mb-10 flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back!</h1>
                <p className="text-gray-500">Manage your personal tasks or collaborate in rooms.</p>
              </div>
              <button 
                onClick={() => navigate('/room/personal')}
                className="px-5 py-2.5 bg-white border border-gray-200 shadow-sm rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                Personal Board
              </button>
            </header>

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                My Rooms
              </h2>
              <button 
                onClick={() => setIsCreatingRoom(true)}
                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {isCreatingRoom && (
              <div className="mb-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-medium text-gray-900 mb-4">Create a New Room</h3>
                <form onSubmit={handleCreateRoom} className="space-y-4">
                  <div>
                    <input 
                      type="text" 
                      placeholder="Room Name" 
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <input 
                      type="text" 
                      placeholder="Description (Optional)" 
                      value={newRoomDesc}
                      onChange={(e) => setNewRoomDesc(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button 
                      type="button" 
                      onClick={() => setIsCreatingRoom(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Create
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map(room => (
                <div 
                  key={room._id} 
                  onClick={() => navigate(`/room/${room._id}`)}
                  className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all group"
                >
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors mb-2">{room.name}</h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{room.description || 'No description provided.'}</p>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {room.members.slice(0, 3).map((member, idx) => (
                        <div key={idx} className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center overflow-hidden">
                          {member.avatar ? <img src={member.avatar} alt="" className="w-full h-full object-cover"/> : <span className="text-xs font-medium text-indigo-700">{member.name ? member.name[0] : 'U'}</span>}
                        </div>
                      ))}
                    </div>
                    {room.members.length > 3 && (
                      <span className="text-xs text-gray-500 font-medium">+{room.members.length - 3} more</span>
                    )}
                  </div>
                </div>
              ))}
              
              {rooms.length === 0 && !isCreatingRoom && (
                <div className="col-span-full py-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-gray-900 font-medium mb-1">No rooms yet</h3>
                  <p className="text-gray-500 text-sm mb-4">Create a room to start collaborating with friends.</p>
                  <button 
                    onClick={() => setIsCreatingRoom(true)}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-indigo-600 font-medium shadow-sm hover:bg-gray-50 transition-colors"
                  >
                    Create your first Room
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>

        <FriendsSidebar />
      </div>
    </div>
  );
};

export default Dashboard;
