// frontend/orval.config.ts
import { defineConfig } from 'orval';

export default defineConfig({
    caizhitong: {
        // 🔥 修改这里：把 /api-json 改为 /docs-json
        input: 'http://localhost:3001/docs-json',

        output: {
            mode: 'tags-split',
            target: 'src/api/generated',
            schemas: 'src/api/model',
            client: 'react-query',
            override: {
                mutator: {
                    path: './src/lib/http.ts',
                    name: 'customInstance',
                },
            },
        },
    },
});