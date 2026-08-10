package com.primeledger.category;

import com.primeledger.category.dto.CategoryRequest;
import com.primeledger.category.dto.CategoryResponse;
import com.primeledger.common.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/categories")
@Tag(name = "Categories", description = "System and user-defined categories")
public class CategoryController {

    private final CategoryService service;

    public CategoryController(CategoryService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "System + user-defined categories")
    public List<CategoryResponse> list() {
        return service.list();
    }

    @PostMapping
    @Operation(summary = "Create a custom category")
    @ApiResponse(responseCode = "201", description = "Created")
    @ApiResponse(
            responseCode = "409",
            description = "A category with this name and kind already exists",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public ResponseEntity<CategoryResponse> create(@Valid @RequestBody CategoryRequest request) {
        CategoryResponse created = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/categories/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Rename, recolour or reorder a category (user-owned only)")
    public CategoryResponse update(
            @PathVariable UUID id, @Valid @RequestBody CategoryRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(
            summary = "Delete a category",
            description =
                    "Transactions filed under it must be moved first: pass reassignTo with the "
                            + "id of another category of the same kind. Without it, a category "
                            + "still in use is refused with 422.")
    @ApiResponse(responseCode = "204", description = "Deleted")
    public ResponseEntity<Void> delete(
            @PathVariable UUID id, @RequestParam(required = false) UUID reassignTo) {
        service.delete(id, reassignTo);
        return ResponseEntity.noContent().build();
    }
}
