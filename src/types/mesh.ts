/**
 * MESH: Local-First Peer-to-Peer Collaboration Types
 */

export interface DeviceIdentity {
  id: string; // e.g. "mesh-node-alpha"
  name: string; // e.g. "Workstation-Alpha"
  ownerName: string; // e.g. "Alex Rivera"
  os: PlatformOS;
  ip: string; // e.g. "192.168.1.104"
  port: number; // e.g. 52442
  fingerprint: string; // SHA-256 fingerprint representation
  publicKey: string;
  avatarSeed: string;
  mDnsName: string; // e.g. "workstation-alpha.local"
  version: string;
  isBroadcasting: boolean;
  emergencyStop: boolean;
}

export type PeerConnectionStatus = 'unpaired' | 'pairing_requested' | 'pairing_incoming' | 'paired' | 'connected' | 'disconnected' | 'revoked';

export interface PeerDevice {
  id: string;
  name: string;
  ownerName: string;
  os: PlatformOS;
  ip: string;
  port: number;
  fingerprint: string;
  publicKey: string;
  mDnsName: string;
  status: PeerConnectionStatus;
  lastSeen: number;
  latencyMs: number;
  isOnline: boolean;
  trustedSince?: number;
  permissions: PeerPermissions;
  activeStreamCount: number;
  transportType?: 'webrtc_direct' | 'cloud_relay';
}

export interface PeerPermissions {
  canView: boolean;      // See resource metadata and directory listing (Default: true)
  canPreview: boolean;   // Open supported content for viewing (Default: true)
  canStream: boolean;    // Read media progressively without full download (Default: true)
  canDownload: boolean;  // Copy resource to peer (Default: false)
  canUpload: boolean;    // Write a new file into a shared destination (Default: false)
  canModify: boolean;    // Change an existing resource (Default: false)
  canDelete: boolean;    // Delete a resource (Default: false)
  expiresAt?: number;    // Optional temporary timestamp expiration
}

export type ResourceType = 'document' | 'video' | 'audio' | 'image' | 'code' | 'archive' | 'folder';

export interface VirtualResource {
  id: string; // Virtual resource ID, e.g. "res_col_001"
  virtualPath: string; // e.g. "/College/DBMS.pdf" - NEVER raw filesystem path
  name: string;
  type: ResourceType;
  mimeType: string;
  sizeBytes: number;
  modifiedAt: number;
  checksumSha256: string;
  isStreamable: boolean;
  isPreviewable: boolean;
  durationSeconds?: number;
  previewUrl?: string; // progressive or data URL
  realFileBlob?: File | Blob;
  isRealLocalFile?: boolean;
  summary?: string;
  ownerDeviceId: string;
  tags?: string[];
}

export interface SharedFolder {
  id: string;
  virtualRoot: string; // e.g. "/College"
  label: string;
  realSourceAlias: string; // e.g. "Documents/College (Local Mount)" - real path never exposed
  resourceCount: number;
  totalSizeBytes: number;
  permissions: PeerPermissions;
  resources: VirtualResource[];
}

export type PlatformOS = 'Windows 11' | 'macOS Sequoia' | 'Ubuntu Linux' | 'Windows 10' | 'Android' | 'iOS' | 'Linux';

export type ProtocolAction = 
  | 'DISCOVER'
  | 'PAIR_REQUEST'
  | 'PAIR_ACCEPT'
  | 'PAIR_REJECT'
  | 'LIST_RESOURCES'
  | 'GET_METADATA'
  | 'READ_CHUNK'
  | 'CHUNK_DATA'
  | 'CHUNK_REQUEST'
  | 'DOWNLOAD_REQUEST'
  | 'TRANSFER_CONTROL'
  | 'STREAM_REQUEST'
  | 'STREAM_DATA'
  | 'STREAM_CHUNK_REQUEST'
  | 'STREAM_CHUNK_DATA'
  | 'STREAM_RANGE_REQUEST'
  | 'STREAM_RANGE_DATA'
  | 'PREVIEW_REQUEST'
  | 'PREVIEW_DATA'
  | 'SIGNAL_OFFER'
  | 'SIGNAL_ANSWER'
  | 'SIGNAL_ICE'
  | 'SEND_TEXT'
  | 'SEND_LINK'
  | 'SEND_FILE'
  | 'CLIPBOARD_SHARE'
  | 'PING'
  | 'PONG'
  | 'REVOKE_ACCESS';

export interface TransferControlPayload {
  transferId: string;
  control: 'pause' | 'resume' | 'cancel';
  reason?: string;
}

export interface ChunkRequestPayload {
  transferId: string;
  resourceId: string;
  chunkIndex: number;
  chunkSize: number;
  totalChunks: number;
}

export interface ChunkDataPayload {
  transferId: string;
  resourceId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkSize: number;
  actualFileSizeBytes?: number;
  dataBase64: string;
  isLast: boolean;
  actualTotalChunks?: number;
}

export interface StreamRequestPayload {
  sessionId: string;
  resourceId: string;
  rangeOffsetBytes: number;
  byteLength?: number;
  seekSeconds?: number;
}

export interface StreamDataPayload {
  sessionId: string;
  resourceId: string;
  chunkIndex: number;
  totalBurstChunks: number;
  rangeOffsetBytes: number;
  totalBytes: number;
  mimeType: string;
  dataBase64: string;
  isEof?: boolean;
}

export interface ProtocolPacket {
  id: string;
  action: ProtocolAction;
  senderId: string;
  senderName: string;
  targetId: string;
  timestamp: number;
  payload: any;
  securityProof?: string;
}

export interface TransferSession {
  id: string;
  resourceId: string;
  resourceName: string;
  fileSizeBytes: number;
  bytesTransferred: number;
  chunkSize: number;
  totalChunks: number;
  currentChunk: number;
  highestRequestedChunk?: number;
  receivedChunkCount?: number;
  transportType?: 'webrtc_direct' | 'cloud_relay' | 'local_bus';
  speedMbps: number;
  direction: 'downloading' | 'uploading';
  peerId: string;
  peerName: string;
  status: 'transferring' | 'paused' | 'completed' | 'cancelled' | 'error';
  errorMessage?: string;
  startedAt: number;
  checksumVerified?: boolean;
  downloadUrl?: string;
}

export interface StreamSession {
  id: string;
  resourceId: string;
  resourceName: string;
  peerId: string;
  peerName: string;
  mimeType: string;
  totalSizeBytes: number;
  bufferedBytes: number;
  rangeOffsetBytes?: number;
  currentPositionSeconds: number;
  durationSeconds: number;
  status: 'streaming' | 'buffering' | 'paused' | 'ended' | 'error';
  requestCount: number;
  speedKbps: number;
  mediaUrl?: string;
}

export interface PeerMessage {
  id: string;
  senderId: string;
  senderName: string;
  targetId?: string; // empty for room messages
  roomId?: string;
  text: string;
  type: 'text' | 'link' | 'clipboard' | 'file_notice';
  linkUrl?: string;
  timestamp: number;
}

export interface CollaborationRoom {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: number;
  memberPeerIds: string[];
  sharedResourceIds: string[];
  isLocked: boolean;
}

export interface ActivityEvent {
  id: string;
  timestamp: number;
  type: 'pairing' | 'stream' | 'transfer' | 'message' | 'security' | 'resource';
  level: 'info' | 'success' | 'warning' | 'alert';
  title: string;
  details: string;
  peerId?: string;
  peerName?: string;
  resourceId?: string;
}
