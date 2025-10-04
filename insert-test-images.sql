INSERT INTO r2_files (
    id, session_id, user_id, filename, original_filename,
    file_type, file_extension, file_size_bytes, file_size_mb,
    r2_key, upload_status, upload_completed_at, created_at, updated_at
) VALUES 
(
    'test-img-001',
    '6fc2ee67-9455-4115-bd43-1102569080e6',
    'dev-test-user-001',
    'wedding_photo_1.jpg',
    'wedding_photo_1.jpg',
    'gallery',
    '.jpg',
    '425984',
    '0.41',
    'dev-test-user-001/6fc2ee67-9455-4115-bd43-1102569080e6/gallery/wedding_photo_1.jpg',
    'completed',
    NOW(),
    NOW(),
    NOW()
),
(
    'test-img-002',
    '6fc2ee67-9455-4115-bd43-1102569080e6',
    'dev-test-user-001',
    'wedding_photo_2.jpg',
    'wedding_photo_2.jpg',
    'gallery',
    '.jpg',
    '412356',
    '0.39',
    'dev-test-user-001/6fc2ee67-9455-4115-bd43-1102569080e6/gallery/wedding_photo_2.jpg',
    'completed',
    NOW(),
    NOW(),
    NOW()
),
(
    'test-img-003',
    '6fc2ee67-9455-4115-bd43-1102569080e6',
    'dev-test-user-001',
    'wedding_photo_3.jpg',
    'wedding_photo_3.jpg',
    'gallery',
    '.jpg',
    '398742',
    '0.38',
    'dev-test-user-001/6fc2ee67-9455-4115-bd43-1102569080e6/gallery/wedding_photo_3.jpg',
    'completed',
    NOW(),
    NOW(),
    NOW()
);
