export namespace domain {

	export class AutomationPoint {
	    bar: number;
	    value: number;

	    static createFrom(source: any = {}) {
	        return new AutomationPoint(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bar = source["bar"];
	        this.value = source["value"];
	    }
	}
	export class AutomationLane {
	    target: string;
	    points: AutomationPoint[];

	    static createFrom(source: any = {}) {
	        return new AutomationLane(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.target = source["target"];
	        this.points = this.convertValues(source["points"], AutomationPoint);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

	export class TransitionFeedback {
	    fromTrackId: string;
	    toTrackId: string;
	    verdict: string;
	    // Go type: time
	    recordedAt: any;

	    static createFrom(source: any = {}) {
	        return new TransitionFeedback(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.fromTrackId = source["fromTrackId"];
	        this.toTrackId = source["toTrackId"];
	        this.verdict = source["verdict"];
	        this.recordedAt = this.convertValues(source["recordedAt"], null);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SourcePlaylist {
	    id: string;
	    name: string;
	    kind: string;
	    imageUrl?: string;
	    trackCount: number;
	    // Go type: time
	    syncedAt: any;

	    static createFrom(source: any = {}) {
	        return new SourcePlaylist(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.kind = source["kind"];
	        this.imageUrl = source["imageUrl"];
	        this.trackCount = source["trackCount"];
	        this.syncedAt = this.convertValues(source["syncedAt"], null);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TransitionPlan {
	    version: string;
	    fromCueId: string;
	    toCueId: string;
	    style: string;
	    bars: number;
	    fromStartSeconds: number;
	    fromEndSeconds: number;
	    toStartSeconds: number;
	    toEndSeconds: number;
	    tempoAdjustmentPct: number;
	    bassSwapBar: number;
	    score: number;
	    risk: string;
	    confidence: number;
	    components: ScoreComponent[];
	    automation: AutomationLane[];
	    notes: string[];
	    renderValidationRequired: boolean;

	    static createFrom(source: any = {}) {
	        return new TransitionPlan(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.fromCueId = source["fromCueId"];
	        this.toCueId = source["toCueId"];
	        this.style = source["style"];
	        this.bars = source["bars"];
	        this.fromStartSeconds = source["fromStartSeconds"];
	        this.fromEndSeconds = source["fromEndSeconds"];
	        this.toStartSeconds = source["toStartSeconds"];
	        this.toEndSeconds = source["toEndSeconds"];
	        this.tempoAdjustmentPct = source["tempoAdjustmentPct"];
	        this.bassSwapBar = source["bassSwapBar"];
	        this.score = source["score"];
	        this.risk = source["risk"];
	        this.confidence = source["confidence"];
	        this.components = this.convertValues(source["components"], ScoreComponent);
	        this.automation = this.convertValues(source["automation"], AutomationLane);
	        this.notes = source["notes"];
	        this.renderValidationRequired = source["renderValidationRequired"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ScoreComponent {
	    name: string;
	    score: number;
	    note: string;

	    static createFrom(source: any = {}) {
	        return new ScoreComponent(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.score = source["score"];
	        this.note = source["note"];
	    }
	}
	export class Transition {
	    fromTrackId: string;
	    toTrackId: string;
	    score: number;
	    risk: string;
	    basis: string;
	    tempoAdjustmentPct: number;
	    tempoOctaveEquivalent: boolean;
	    confidence: number;
	    summary: string;
	    components: ScoreComponent[];
	    plan?: TransitionPlan;

	    static createFrom(source: any = {}) {
	        return new Transition(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.fromTrackId = source["fromTrackId"];
	        this.toTrackId = source["toTrackId"];
	        this.score = source["score"];
	        this.risk = source["risk"];
	        this.basis = source["basis"];
	        this.tempoAdjustmentPct = source["tempoAdjustmentPct"];
	        this.tempoOctaveEquivalent = source["tempoOctaveEquivalent"];
	        this.confidence = source["confidence"];
	        this.summary = source["summary"];
	        this.components = this.convertValues(source["components"], ScoreComponent);
	        this.plan = this.convertValues(source["plan"], TransitionPlan);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SetTrack {
	    position: number;
	    track: Track;
	    targetEnergy: number;
	    transition: Transition;

	    static createFrom(source: any = {}) {
	        return new SetTrack(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.position = source["position"];
	        this.track = this.convertValues(source["track"], Track);
	        this.targetEnergy = source["targetEnergy"];
	        this.transition = this.convertValues(source["transition"], Transition);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SetDraft {
	    id: string;
	    sessionId: string;
	    name: string;
	    variation: number;
	    arc: string;
	    durationSeconds: number;
	    durationBasis: string;
	    qualityScore: number;
	    scoreVersion: string;
	    energyFit: number;
	    harmonicFlow: number;
	    tempoFlow: number;
	    diversity: number;
	    transitionSafety: number;
	    weakestTransition: number;
	    highRiskTransitions: number;
	    analysisConfidence: number;
	    temporalCoverage: number;
	    temporalConfidence: number;
	    // Go type: time
	    createdAt: any;
	    tracks: SetTrack[];

	    static createFrom(source: any = {}) {
	        return new SetDraft(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.sessionId = source["sessionId"];
	        this.name = source["name"];
	        this.variation = source["variation"];
	        this.arc = source["arc"];
	        this.durationSeconds = source["durationSeconds"];
	        this.durationBasis = source["durationBasis"];
	        this.qualityScore = source["qualityScore"];
	        this.scoreVersion = source["scoreVersion"];
	        this.energyFit = source["energyFit"];
	        this.harmonicFlow = source["harmonicFlow"];
	        this.tempoFlow = source["tempoFlow"];
	        this.diversity = source["diversity"];
	        this.transitionSafety = source["transitionSafety"];
	        this.weakestTransition = source["weakestTransition"];
	        this.highRiskTransitions = source["highRiskTransitions"];
	        this.analysisConfidence = source["analysisConfidence"];
	        this.temporalCoverage = source["temporalCoverage"];
	        this.temporalConfidence = source["temporalConfidence"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.tracks = this.convertValues(source["tracks"], SetTrack);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Track {
	    id: string;
	    spotifyId?: string;
	    spotifyUri?: string;
	    title: string;
	    artist: string;
	    albumImageUrl?: string;
	    durationSeconds: number;
	    bpm: number;
	    musicalKey: string;
	    camelot: string;
	    energy: number;
	    groove: string;
	    vocal: number;
	    role: string;
	    sourcePlaylist: string;
	    sourcePlaylistIds?: string[];
	    // Go type: time
	    addedAt: any;
	    featureConfidence: number;
	    featureProvenance: string;
	    featureNeedsReview: boolean;

	    static createFrom(source: any = {}) {
	        return new Track(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.spotifyId = source["spotifyId"];
	        this.spotifyUri = source["spotifyUri"];
	        this.title = source["title"];
	        this.artist = source["artist"];
	        this.albumImageUrl = source["albumImageUrl"];
	        this.durationSeconds = source["durationSeconds"];
	        this.bpm = source["bpm"];
	        this.musicalKey = source["musicalKey"];
	        this.camelot = source["camelot"];
	        this.energy = source["energy"];
	        this.groove = source["groove"];
	        this.vocal = source["vocal"];
	        this.role = source["role"];
	        this.sourcePlaylist = source["sourcePlaylist"];
	        this.sourcePlaylistIds = source["sourcePlaylistIds"];
	        this.addedAt = this.convertValues(source["addedAt"], null);
	        this.featureConfidence = source["featureConfidence"];
	        this.featureProvenance = source["featureProvenance"];
	        this.featureNeedsReview = source["featureNeedsReview"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Bootstrap {
	    databaseReady: boolean;
	    trackCount: number;
	    draftCount: number;
	    tracks: Track[];
	    drafts: SetDraft[];
	    syncedPlaylists: SourcePlaylist[];
	    transitionFeedback: TransitionFeedback[];
	    error?: string;

	    static createFrom(source: any = {}) {
	        return new Bootstrap(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.databaseReady = source["databaseReady"];
	        this.trackCount = source["trackCount"];
	        this.draftCount = source["draftCount"];
	        this.tracks = this.convertValues(source["tracks"], Track);
	        this.drafts = this.convertValues(source["drafts"], SetDraft);
	        this.syncedPlaylists = this.convertValues(source["syncedPlaylists"], SourcePlaylist);
	        this.transitionFeedback = this.convertValues(source["transitionFeedback"], TransitionFeedback);
	        this.error = source["error"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GenerateRequest {
	    name: string;
	    durationMinutes: number;
	    variationCount: number;
	    arc: string;
	    harmonicStrictness: number;
	    exploration: number;
	    startBpm: number;
	    endBpm: number;
	    allowedGrooves?: string[];
	    sourcePlaylistIds?: string[];
	    requiredTrackIds?: string[];
	    excludedTrackIds?: string[];
	    seed: number;

	    static createFrom(source: any = {}) {
	        return new GenerateRequest(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.durationMinutes = source["durationMinutes"];
	        this.variationCount = source["variationCount"];
	        this.arc = source["arc"];
	        this.harmonicStrictness = source["harmonicStrictness"];
	        this.exploration = source["exploration"];
	        this.startBpm = source["startBpm"];
	        this.endBpm = source["endBpm"];
	        this.allowedGrooves = source["allowedGrooves"];
	        this.sourcePlaylistIds = source["sourcePlaylistIds"];
	        this.requiredTrackIds = source["requiredTrackIds"];
	        this.excludedTrackIds = source["excludedTrackIds"];
	        this.seed = source["seed"];
	    }
	}





	export class TrackEnrichment {
	    trackId: string;
	    bpm: number;
	    musicalKey: string;
	    camelot: string;
	    energy: number;
	    groove: string;
	    vocal: number;
	    role: string;
	    source: string;
	    confidence: number;

	    static createFrom(source: any = {}) {
	        return new TrackEnrichment(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.trackId = source["trackId"];
	        this.bpm = source["bpm"];
	        this.musicalKey = source["musicalKey"];
	        this.camelot = source["camelot"];
	        this.energy = source["energy"];
	        this.groove = source["groove"];
	        this.vocal = source["vocal"];
	        this.role = source["role"];
	        this.source = source["source"];
	        this.confidence = source["confidence"];
	    }
	}
	export class WaveformPoint {
	    startSeconds: number;
	    endSeconds: number;
	    rms: number;
	    peak: number;

	    static createFrom(source: any = {}) {
	        return new WaveformPoint(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.startSeconds = source["startSeconds"];
	        this.endSeconds = source["endSeconds"];
	        this.rms = source["rms"];
	        this.peak = source["peak"];
	    }
	}
	export class TrackWaveform {
	    trackId: string;
	    durationSeconds: number;
	    analyzerVersion?: string;
	    waveform: WaveformPoint[];

	    static createFrom(source: any = {}) {
	        return new TrackWaveform(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.trackId = source["trackId"];
	        this.durationSeconds = source["durationSeconds"];
	        this.analyzerVersion = source["analyzerVersion"];
	        this.waveform = this.convertValues(source["waveform"], WaveformPoint);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}




}

export namespace spotify {

	export class Playlist {
	    ID: string;
	    Name: string;
	    Kind: string;
	    Writable: boolean;
	    ImageURL: string;
	    TrackCount: number;
	    Synced: boolean;

	    static createFrom(source: any = {}) {
	        return new Playlist(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.Name = source["Name"];
	        this.Kind = source["Kind"];
	        this.Writable = source["Writable"];
	        this.ImageURL = source["ImageURL"];
	        this.TrackCount = source["TrackCount"];
	        this.Synced = source["Synced"];
	    }
	}

}

export namespace tidal {

	export class CapabilityReport {
	    configured: boolean;
	    connected: boolean;
	    grantedScopes: string[];
	    createPlaylist: boolean;
	    readPlaylist: boolean;
	    addPlaylistItem: boolean;
	    deletePlaylist: boolean;
	    probePlaylistId?: string;
	    message: string;

	    static createFrom(source: any = {}) {
	        return new CapabilityReport(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.configured = source["configured"];
	        this.connected = source["connected"];
	        this.grantedScopes = source["grantedScopes"];
	        this.createPlaylist = source["createPlaylist"];
	        this.readPlaylist = source["readPlaylist"];
	        this.addPlaylistItem = source["addPlaylistItem"];
	        this.deletePlaylist = source["deletePlaylist"];
	        this.probePlaylistId = source["probePlaylistId"];
	        this.message = source["message"];
	    }
	}
	export class PreviewPlaylist {
	    playlistId: string;
	    draftId: string;
	    sessionId: string;
	    variation: number;
	    name: string;
	    // Go type: time
	    createdAt: any;

	    static createFrom(source: any = {}) {
	        return new PreviewPlaylist(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.playlistId = source["playlistId"];
	        this.draftId = source["draftId"];
	        this.sessionId = source["sessionId"];
	        this.variation = source["variation"];
	        this.name = source["name"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PreviewBatch {
	    playlists: PreviewPlaylist[];
	    matchedTracks: number;
	    deletedPrevious: number;
	    warnings: string[];

	    static createFrom(source: any = {}) {
	        return new PreviewBatch(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.playlists = this.convertValues(source["playlists"], PreviewPlaylist);
	        this.matchedTracks = source["matchedTracks"];
	        this.deletedPrevious = source["deletedPrevious"];
	        this.warnings = source["warnings"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

	export class SavedSet {
	    playlistId: string;
	    draftId: string;
	    sessionId: string;
	    variation: number;
	    name: string;
	    trackCount: number;
	    // Go type: time
	    createdAt: any;

	    static createFrom(source: any = {}) {
	        return new SavedSet(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.playlistId = source["playlistId"];
	        this.draftId = source["draftId"];
	        this.sessionId = source["sessionId"];
	        this.variation = source["variation"];
	        this.name = source["name"];
	        this.trackCount = source["trackCount"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Status {
	    configured: boolean;
	    connected: boolean;
	    grantedScopes: string[];

	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.configured = source["configured"];
	        this.connected = source["connected"];
	        this.grantedScopes = source["grantedScopes"];
	    }
	}

}

