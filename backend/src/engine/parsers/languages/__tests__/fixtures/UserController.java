package com.example.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import javax.persistence.*;
import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable String id) {
        return userService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<User> createUser(@RequestBody CreateUserRequest request) {
        User user = userService.create(request.getName(), request.getEmail());
        return ResponseEntity.created(null).body(user);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable String id) {
        userService.delete(id);
        return ResponseEntity.noContent().build();
    }
}

@Entity
@Table(name = "users")
record UserRecord(
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    String id,
    @Column(nullable = false)
    String name,
    @Column(unique = true)
    String email
) {}

interface UserRepository extends JpaRepository<UserRecord, String> {
    List<UserRecord> findByNameContaining(String name);
    
    @Query("SELECT u FROM UserRecord u WHERE u.email = :email")
    Optional<UserRecord> findByEmail(@Param("email") String email);
}

enum UserRole {
    ADMIN,
    USER,
    MODERATOR
}
