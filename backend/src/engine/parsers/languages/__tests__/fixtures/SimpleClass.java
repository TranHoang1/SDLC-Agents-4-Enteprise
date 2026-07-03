package com.example.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import static java.util.Collections.emptyList;
import com.example.model.*;

/**
 * A simple service class for testing.
 */
public class UserService extends BaseService implements Serializable, Auditable {

    private static final String DEFAULT_ROLE = "USER";
    private final UserRepository repository;
    private Map<String, User> cache;

    public UserService(UserRepository repository) {
        this.repository = repository;
        this.cache = new java.util.HashMap<>();
    }

    public Optional<User> findById(String id) {
        if (cache.containsKey(id)) {
            return Optional.of(cache.get(id));
        }
        Optional<User> user = repository.findById(id);
        user.ifPresent(u -> cache.put(id, u));
        return user;
    }

    public List<User> findAll() {
        return repository.findAll();
    }

    public User create(String name, String email) {
        User user = new User(name, email);
        user.setRole(DEFAULT_ROLE);
        User saved = repository.save(user);
        cache.put(saved.getId(), saved);
        notifyCreation(saved);
        return saved;
    }

    private void notifyCreation(User user) {
        EventBus.publish(new UserCreatedEvent(user));
    }

    protected void clearCache() {
        cache.clear();
    }

    // Inner class
    public static class UserBuilder {
        private String name;
        private String email;

        public UserBuilder name(String name) {
            this.name = name;
            return this;
        }

        public UserBuilder email(String email) {
            this.email = email;
            return this;
        }

        public User build() {
            return new User(name, email);
        }
    }
}
