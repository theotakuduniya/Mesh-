/**
 * Virtual Shared Space Architecture
 * 
 * Maps internal mock local filesystem paths to virtual resource IDs and paths.
 * Peers ONLY interact with virtual IDs (e.g. "res_col_001") and virtual paths (e.g. "/College/DBMS.pdf").
 * The real filesystem path (e.g. "D:\Projects\Mesh\...") is NEVER leaked to any peer.
 */

import { VirtualResource, SharedFolder, PeerPermissions } from '../types/mesh';

export const DEFAULT_PERMISSIONS: PeerPermissions = {
  canView: true,
  canPreview: true,
  canStream: true,
  canDownload: false, // Off by default as required by specification
  canUpload: false,
  canModify: false,
  canDelete: false,
};

export const INITIAL_SHARED_FOLDERS_PC_A: SharedFolder[] = [
  {
    id: 'folder_college',
    virtualRoot: '/College',
    label: 'College Coursework',
    realSourceAlias: 'Local Volume (D:) -> Documents/University/Fall2026',
    resourceCount: 2,
    totalSizeBytes: 318000000, // ~318 MB
    permissions: {
      canView: true,
      canPreview: true,
      canStream: true,
      canDownload: true, // Specifically permitted for pairing demo
      canUpload: false,
      canModify: false,
      canDelete: false,
    },
    resources: [
      {
        id: 'res_col_001',
        virtualPath: '/College/DBMS.pdf',
        name: 'DBMS.pdf',
        type: 'document',
        mimeType: 'application/pdf',
        sizeBytes: 4820000, // 4.82 MB
        modifiedAt: Date.now() - 86400000 * 2,
        checksumSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        isStreamable: false,
        isPreviewable: true,
        summary: 'Database Management Systems Lecture Notes: Relational Algebra, B+ Trees, ACID Transactions and Distributed Consensuses.',
        ownerDeviceId: 'node_alpha',
        tags: ['coursework', 'notes', 'academics'],
      },
      {
        id: 'res_col_002',
        virtualPath: '/College/OS.pdf',
        name: 'OS.pdf',
        type: 'document',
        mimeType: 'application/pdf',
        sizeBytes: 7420000, // 7.42 MB
        modifiedAt: Date.now() - 86400000 * 4,
        checksumSha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
        isStreamable: false,
        isPreviewable: true,
        summary: 'Operating Systems: Kernel architecture, memory paging, mutual exclusion semaphores, and asynchronous POSIX I/O.',
        ownerDeviceId: 'node_alpha',
        tags: ['unix', 'kernel', 'slides'],
      },
    ],
  },
  {
    id: 'folder_media',
    virtualRoot: '/Media',
    label: 'Lecture Media & Recordings',
    realSourceAlias: 'Local Volume (C:) -> Users/Alex/Videos/Recordings',
    resourceCount: 2,
    totalSizeBytes: 1845000000, // ~1.84 GB
    permissions: {
      canView: true,
      canPreview: true,
      canStream: true,
      canDownload: false, // Streamable progressive direct playback without download
      canUpload: false,
      canModify: false,
      canDelete: false,
    },
    resources: [
      {
        id: 'res_med_001',
        virtualPath: '/Media/lecture.mp4',
        name: 'lecture.mp4',
        type: 'video',
        mimeType: 'video/mp4',
        sizeBytes: 420000000, // 420 MB
        modifiedAt: Date.now() - 3600000 * 5,
        checksumSha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
        isStreamable: true,
        isPreviewable: true,
        durationSeconds: 194, // ~3 min 14 sec
        summary: 'High-Definition Recording: Distributed Systems & Consensus Algorithms (Prof. Vance, 1080p 60fps with chapter marks)',
        ownerDeviceId: 'node_alpha',
        tags: ['lecture', 'video', '1080p', 'p2p-stream'],
      },
      {
        id: 'res_med_002',
        virtualPath: '/Media/lab_audio_sync.mp3',
        name: 'lab_audio_sync.mp3',
        type: 'audio',
        mimeType: 'audio/mp3',
        sizeBytes: 18500000, // 18.5 MB
        modifiedAt: Date.now() - 86400000 * 1,
        checksumSha256: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
        isStreamable: true,
        isPreviewable: true,
        durationSeconds: 142,
        summary: 'Synchronized binaural lab session recording for acoustics analysis and network protocol audio test.',
        ownerDeviceId: 'node_alpha',
        tags: ['audio', 'hifi', 'streamable'],
      },
    ],
  },
  {
    id: 'folder_projects',
    virtualRoot: '/Projects',
    label: 'Engineering Projects',
    realSourceAlias: 'Local Volume (D:) -> Code/ActiveProjects',
    resourceCount: 2,
    totalSizeBytes: 24500000, // 24.5 MB
    permissions: {
      canView: true,
      canPreview: true,
      canStream: false,
      canDownload: true,
      canUpload: true,
      canModify: false,
      canDelete: false,
    },
    resources: [
      {
        id: 'res_proj_001',
        virtualPath: '/Projects/CARENET.pptx',
        name: 'CARENET.pptx',
        type: 'document',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        sizeBytes: 14200000, // 14.2 MB
        modifiedAt: Date.now() - 3600000 * 24,
        checksumSha256: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
        isStreamable: false,
        isPreviewable: true,
        summary: 'Healthcare Decentralized Dispatch Pitch Deck & Architecture Diagrams.',
        ownerDeviceId: 'node_alpha',
        tags: ['presentation', 'pitch', 'slides'],
      },
      {
        id: 'res_proj_002',
        virtualPath: '/Projects/mesh_protocol_spec.json',
        name: 'mesh_protocol_spec.json',
        type: 'code',
        mimeType: 'application/json',
        sizeBytes: 42000, // 42 KB
        modifiedAt: Date.now() - 3600000 * 2,
        checksumSha256: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
        isStreamable: false,
        isPreviewable: true,
        summary: 'Machine-readable schema definitions for Mesh P2P wire packets and capabilities.',
        ownerDeviceId: 'node_alpha',
        tags: ['json', 'spec', 'rfc'],
      },
    ],
  },
];

export const INITIAL_SHARED_FOLDERS_PC_B: SharedFolder[] = [
  {
    id: 'folder_research_b',
    virtualRoot: '/Research',
    label: 'Distributed Systems Papers',
    realSourceAlias: 'Macintosh HD -> Users/Jordan/Documents/Research',
    resourceCount: 2,
    totalSizeBytes: 18500000,
    permissions: {
      canView: true,
      canPreview: true,
      canStream: false,
      canDownload: true,
      canUpload: false,
      canModify: false,
      canDelete: false,
    },
    resources: [
      {
        id: 'res_b_001',
        virtualPath: '/Research/byzantine_consensus_lan.pdf',
        name: 'byzantine_consensus_lan.pdf',
        type: 'document',
        mimeType: 'application/pdf',
        sizeBytes: 6200000,
        modifiedAt: Date.now() - 86400000 * 1,
        checksumSha256: '3a55d04586ff90d1f7e0d37e96e579bd66c1b30bc0777593c6f49f6479ff73bd',
        isStreamable: false,
        isPreviewable: true,
        summary: 'Practical Byzantine Fault Tolerance for Zero-Cloud Peer Meshes in Local Subnets.',
        ownerDeviceId: 'node_beta',
        tags: ['paper', 'security', 'lan'],
      },
      {
        id: 'res_b_002',
        virtualPath: '/Research/benchmarks_chart.png',
        name: 'benchmarks_chart.png',
        type: 'image',
        mimeType: 'image/png',
        sizeBytes: 1250000,
        modifiedAt: Date.now() - 3600000 * 8,
        checksumSha256: '8f434346648f6b96df89dda901c5176b10e6d83961dd3c1ac88b59b2dc327aa4',
        isStreamable: false,
        isPreviewable: true,
        summary: 'Throughput comparison: WebRTC DataChannel chunking vs Raw TCP LAN transfers.',
        ownerDeviceId: 'node_beta',
        tags: ['chart', 'benchmark'],
      },
    ],
  },
];

/**
 * Validates whether a requested action is allowed under the current permission set.
 */
export function verifyPermission(
  permissions: PeerPermissions,
  action: 'VIEW' | 'PREVIEW' | 'STREAM' | 'DOWNLOAD' | 'UPLOAD' | 'MODIFY' | 'DELETE'
): { allowed: boolean; reason?: string } {
  if (permissions.expiresAt && Date.now() > permissions.expiresAt) {
    return { allowed: false, reason: 'Temporary authorization window has expired' };
  }

  switch (action) {
    case 'VIEW':
      return { allowed: permissions.canView, reason: permissions.canView ? undefined : 'View permission denied' };
    case 'PREVIEW':
      return { allowed: permissions.canPreview, reason: permissions.canPreview ? undefined : 'Remote preview permission denied' };
    case 'STREAM':
      return { allowed: permissions.canStream, reason: permissions.canStream ? undefined : 'Direct streaming permission disabled by peer' };
    case 'DOWNLOAD':
      return { allowed: permissions.canDownload, reason: permissions.canDownload ? undefined : 'Full file download permission restricted' };
    case 'UPLOAD':
      return { allowed: permissions.canUpload, reason: permissions.canUpload ? undefined : 'Remote upload denied' };
    case 'MODIFY':
      return { allowed: permissions.canModify, reason: permissions.canModify ? undefined : 'Resource mutation denied' };
    case 'DELETE':
      return { allowed: permissions.canDelete, reason: permissions.canDelete ? undefined : 'Resource deletion prohibited' };
    default:
      return { allowed: false, reason: 'Unrecognized operation' };
  }
}
