// Force inclusion of @types/multer namespace augmentation.
// @types/multer is a module (has top-level imports), so its `declare global`
// only takes effect when the package is explicitly imported.
import 'multer';
