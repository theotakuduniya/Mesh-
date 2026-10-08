import React, { useState } from 'react';
import {
  Users2,
  Plus,
  Send,
  Laptop,
  ExternalLink,
  PanelLeft,
  PanelLeftClose,
  X,
} from 'lucide-react';
import { useMesh } from '../../context/MeshContext';

export const RoomsView: React.FC = () => {
  const {
    rooms,
    createRoom,
    selectedRoomId,
    setSelectedRoomId,
    messages,
    sendMessage,
    currentDevice,
    toggleSidebar,
    isSidebarCollapsed,
  } = useMesh();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [chatText, setChatText] = useState('');

  const activeRoom = rooms.find((r) => r.id === selectedRoomId) || rooms[0];
  const roomMessages = messages.filter((m) => m.roomId === activeRoom?.id);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    createRoom(newRoomName.trim(), newRoomDesc.trim() || 'LAN Room');
    setNewRoomName('');
    setNewRoomDesc('');
    setIsCreateOpen(false);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim() || !activeRoom) return;

    const isLink = chatText.startsWith('http://') || chatText.startsWith('https://');
    sendMessage(undefined, chatText.trim(), isLink ? 'link' : 'text', isLink ? chatText.trim() : undefined, activeRoom.id);
    setChatText('');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0d11] overflow-hidden">
      {/* Centered Desktop Header Container */}
      <div className="w-full border-b border-white/[0.06] bg-[#0c0d12]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white font-display">Rooms</h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Local collaboration channels on this subnet
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Room</span>
          </button>
        </div>
      </div>

      {/* Main Two-Pane Centered View */}
      <div className="flex-1 flex justify-center overflow-hidden w-full">
        <div className="max-w-5xl w-full flex overflow-hidden h-full p-6 gap-5">
          {/* Left Pane: Channels */}
          <div className="w-60 bg-[#12141a] border border-white/[0.06] rounded-xl p-3 overflow-y-auto space-y-1 shrink-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-2 py-1">
              Channels
            </div>

            {rooms.map((room) => {
              const isSelected = activeRoom?.id === room.id;
              return (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  className={`w-full text-left p-2.5 rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-zinc-800 text-white font-medium border border-white/10'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.03] border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate">#{room.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {room.memberPeerIds.length}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Pane: Room Discussion */}
          {activeRoom ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-[#12141a] border border-white/[0.06] rounded-xl">
              {/* Room Subheader */}
              <div className="px-5 py-3 border-b border-white/[0.06] bg-zinc-900/50 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold text-white font-mono">#{activeRoom.name}</h2>
                  <div className="text-[11px] text-zinc-400 truncate">{activeRoom.description}</div>
                </div>

                <div className="flex items-center gap-1">
                  {activeRoom.memberPeerIds.map((id) => (
                    <div
                      key={id}
                      className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-zinc-400"
                      title={id}
                    >
                      <Laptop className="w-3 h-3" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-5 overflow-y-auto space-y-2.5">
                {roomMessages.length === 0 ? (
                  <div className="text-center py-20 text-zinc-500 text-xs">
                    No messages yet in #{activeRoom.name}.
                  </div>
                ) : (
                  roomMessages.map((msg) => {
                    const isMe = msg.senderId === currentDevice.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div className="text-[10px] text-zinc-500 mb-0.5 px-1 font-mono">
                          {msg.senderName}
                        </div>
                        <div
                          className={`max-w-[80%] p-2.5 rounded-xl text-xs ${
                            isMe
                              ? 'bg-blue-600 text-white'
                              : 'bg-zinc-800 text-zinc-200 border border-white/5'
                          }`}
                        >
                          {msg.type === 'link' ? (
                            <a
                              href={msg.linkUrl || msg.text}
                              target="_blank"
                              rel="noreferrer"
                              className="underline hover:text-blue-200 flex items-center gap-1"
                            >
                              <span>{msg.text}</span>
                              <ExternalLink className="w-3 h-3 inline" />
                            </a>
                          ) : (
                            <span>{msg.text}</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSend} className="p-3 bg-zinc-900/40 border-t border-white/[0.06] flex gap-2">
                <input
                  type="text"
                  placeholder={`Message #${activeRoom.name}...`}
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-zinc-900 border border-white/5 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-zinc-500 bg-[#12141a] border border-white/[0.06] rounded-xl">
              Select or create a room.
            </div>
          )}
        </div>
      </div>

      {/* Create Room Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreate}
            className="bg-[#12141a] border border-white/15 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-white font-display">Create Room</div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Room Name</label>
                <input
                  type="text"
                  placeholder="e.g. project-team"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-white/5 rounded-md text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Local sprint sync"
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-white/5 rounded-md text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-md"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
