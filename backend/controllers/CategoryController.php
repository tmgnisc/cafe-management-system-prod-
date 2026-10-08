<?php
declare(strict_types=1);

final class CategoryController
{
    public function index(Request $request): void
    {
        $includeInactive = $request->isAdmin() && filter_var($request->query('include_inactive'), FILTER_VALIDATE_BOOLEAN);
        Response::success(Category::all($includeInactive, $request->query('search')));
    }

    public function show(Request $request, int $id): void
    {
        Response::success($this->findOrFail($id));
    }

    public function store(Request $request): void
    {
        $data = $this->validate($request->body);
        if (Category::nameExists($data['name'])) {
            throw HttpException::validation(['name' => ['A category with this name already exists.']]);
        }
        $id = Category::create($data);
        AuditLog::record($request->userId(), 'CATEGORY_CREATED', "Created category {$data['name']}", 'category', $id, null, $data);
        Response::created(Category::find($id), 'Category created successfully');
    }

    public function update(Request $request, int $id): void
    {
        $before = $this->findOrFail($id);
        $data = $this->validate($request->body, true);
        if (isset($data['name']) && Category::nameExists($data['name'], $id)) {
            throw HttpException::validation(['name' => ['A category with this name already exists.']]);
        }
        Category::update($id, $data);
        AuditLog::record($request->userId(), 'CATEGORY_UPDATED', "Updated category {$before['name']}", 'category', $id, array_intersect_key($before, $data), $data);
        Response::success(Category::find($id), 'Category updated successfully');
    }

    /** Categories with menu items are deactivated, empty ones are deleted. */
    public function destroy(Request $request, int $id): void
    {
        $cat = $this->findOrFail($id);
        if (Category::hasMenuItems($id)) {
            Category::update($id, ['is_active' => 0]);
            AuditLog::record($request->userId(), 'CATEGORY_DEACTIVATED', "Deactivated category {$cat['name']}", 'category', $id);
            Response::success(Category::find($id), 'Category has menu items and was deactivated instead of deleted');
            return;
        }
        Category::delete($id);
        AuditLog::record($request->userId(), 'CATEGORY_DELETED', "Deleted category {$cat['name']}", 'category', $id, $cat);
        Response::success(null, 'Category deleted');
    }

    private function validate(array $body, bool $partial = false): array
    {
        $s = $partial ? 'sometimes|' : '';
        return Validator::validate($body, [
            'name'        => $s . 'required|string|min:2|max:80',
            'description' => 'sometimes|nullable|string|max:255',
            'sort_order'  => 'sometimes|integer|min:0|max:9999',
            'is_active'   => 'sometimes|boolean',
        ]);
    }

    private function findOrFail(int $id): array
    {
        $c = Category::find($id);
        if (!$c) {
            throw HttpException::notFound('Category not found');
        }
        return $c;
    }
}
