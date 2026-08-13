package tidal

import (
	"encoding/json"
	"fmt"

	"github.com/zalando/go-keyring"
)

const keyringService = "cueflow.tidal.oauth"
const keyringAccount = "default"

type TokenStore interface {
	Load() (Token, error)
	Save(Token) error
}

type KeyringStore struct{}

func (KeyringStore) Load() (Token, error) {
	value, err := keyring.Get(keyringService, keyringAccount)
	if err != nil {
		return Token{}, err
	}
	var token Token
	if err := json.Unmarshal([]byte(value), &token); err != nil {
		return Token{}, fmt.Errorf("decode TIDAL token from Keychain: %w", err)
	}
	return token, nil
}

func (KeyringStore) Save(token Token) error {
	value, err := json.Marshal(token)
	if err != nil {
		return err
	}
	return keyring.Set(keyringService, keyringAccount, string(value))
}
