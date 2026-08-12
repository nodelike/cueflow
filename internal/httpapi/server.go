package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"cueflow/internal/domain"
	"cueflow/internal/service"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type Server struct {
	service *service.Service
	logger  *slog.Logger
}

func New(svc *service.Service, logger *slog.Logger) http.Handler {
	server := &Server{service: svc, logger: logger}
	router := chi.NewRouter()
	router.Use(middleware.RequestID, middleware.RealIP, middleware.Recoverer)
	router.Use(cors)
	router.Get("/healthz", server.health)
	router.Get("/api/bootstrap", server.bootstrap)
	router.Post("/api/seed", server.seed)
	router.Post("/api/sets/generate", server.generate)
	router.Get("/api/spotify/status", server.spotifyStatus)
	router.Post("/api/sets/{id}/publish", server.publish)
	router.Get("/api/research/queue", server.researchQueue)
	router.Put("/api/tracks/{id}/enrichment", server.enrichTrack)
	return router
}

func (s *Server) researchQueue(writer http.ResponseWriter, request *http.Request) {
	tracks, err := s.service.NeedsReview(request.Context(), 1000)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err)
		return
	}
	writeJSON(writer, http.StatusOK, tracks)
}

func (s *Server) enrichTrack(writer http.ResponseWriter, request *http.Request) {
	var input domain.TrackEnrichment
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(writer, http.StatusBadRequest, err)
		return
	}
	input.TrackID = chi.URLParam(request, "id")
	if err := s.service.EnrichTrack(request.Context(), input); err != nil {
		writeError(writer, http.StatusUnprocessableEntity, err)
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}

func (s *Server) spotifyStatus(writer http.ResponseWriter, request *http.Request) {
	writeJSON(writer, http.StatusOK, map[string]bool{"connected": s.service.SpotifyConnected()})
}

func (s *Server) publish(writer http.ResponseWriter, request *http.Request) {
	playlist, err := s.service.Publish(request.Context(), chi.URLParam(request, "id"))
	if err != nil {
		writeError(writer, http.StatusUnprocessableEntity, err)
		return
	}
	writeJSON(writer, http.StatusCreated, playlist)
}

func (s *Server) health(writer http.ResponseWriter, request *http.Request) {
	writeJSON(writer, http.StatusOK, map[string]any{"status": "ok", "time": time.Now().UTC()})
}

func (s *Server) bootstrap(writer http.ResponseWriter, request *http.Request) {
	result := s.service.Bootstrap(request.Context())
	status := http.StatusOK
	if result.Error != "" {
		status = http.StatusServiceUnavailable
	}
	writeJSON(writer, status, result)
}

func (s *Server) seed(writer http.ResponseWriter, request *http.Request) {
	if err := s.service.Seed(request.Context()); err != nil {
		writeError(writer, http.StatusInternalServerError, err)
		return
	}
	writeJSON(writer, http.StatusOK, s.service.Bootstrap(request.Context()))
}

func (s *Server) generate(writer http.ResponseWriter, request *http.Request) {
	var input domain.GenerateRequest
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeError(writer, http.StatusBadRequest, err)
		return
	}
	drafts, err := s.service.Generate(request.Context(), input)
	if err != nil {
		writeError(writer, http.StatusUnprocessableEntity, err)
		return
	}
	writeJSON(writer, http.StatusCreated, drafts)
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}

func writeError(writer http.ResponseWriter, status int, err error) {
	writeJSON(writer, status, map[string]string{"error": err.Error()})
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		origin := request.Header.Get("Origin")
		if strings.HasPrefix(origin, "http://127.0.0.1:") || strings.HasPrefix(origin, "http://localhost:") {
			writer.Header().Set("Access-Control-Allow-Origin", origin)
			writer.Header().Set("Vary", "Origin")
			writer.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			writer.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS")
		}
		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(writer, request)
	})
}
