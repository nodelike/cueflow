export namespace domain {
	
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
	    summary: string;
	    components: ScoreComponent[];
	
	    static createFrom(source: any = {}) {
	        return new Transition(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.fromTrackId = source["fromTrackId"];
	        this.toTrackId = source["toTrackId"];
	        this.score = source["score"];
	        this.risk = source["risk"];
	        this.summary = source["summary"];
	        this.components = this.convertValues(source["components"], ScoreComponent);
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
	    qualityScore: number;
	    energyFit: number;
	    harmonicFlow: number;
	    tempoFlow: number;
	    diversity: number;
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
	        this.qualityScore = source["qualityScore"];
	        this.energyFit = source["energyFit"];
	        this.harmonicFlow = source["harmonicFlow"];
	        this.tempoFlow = source["tempoFlow"];
	        this.diversity = source["diversity"];
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
	    durationSeconds: number;
	    bpm: number;
	    musicalKey: string;
	    camelot: string;
	    energy: number;
	    groove: string;
	    vocal: number;
	    role: string;
	    sourcePlaylist: string;
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
	        this.durationSeconds = source["durationSeconds"];
	        this.bpm = source["bpm"];
	        this.musicalKey = source["musicalKey"];
	        this.camelot = source["camelot"];
	        this.energy = source["energy"];
	        this.groove = source["groove"];
	        this.vocal = source["vocal"];
	        this.role = source["role"];
	        this.sourcePlaylist = source["sourcePlaylist"];
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

}

export namespace spotify {
	
	export class Playlist {
	    ID: string;
	    Name: string;
	    Kind: string;
	    Writable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Playlist(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.Name = source["Name"];
	        this.Kind = source["Kind"];
	        this.Writable = source["Writable"];
	    }
	}

}

