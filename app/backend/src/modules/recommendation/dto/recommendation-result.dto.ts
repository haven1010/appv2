import { ApiProperty } from '@nestjs/swagger';

export class RecommendationResultDto {
    @ApiProperty({ description: '基地ID', example: 1 })
    id: number;

    @ApiProperty({ description: '基地名称', example: '青山湖草莓园' })
    baseName: string;

    @ApiProperty({ description: '基地类别', example: '水果种植' })
    categoryName: string;

    @ApiProperty({ description: '区域代码', example: 330100 })
    regionCode: number;

    @ApiProperty({ description: '推荐得分 (0-100)', example: 90 })
    score: number;

    @ApiProperty({ description: '推荐理由列表', example: ['同城基地', '符合您的工种偏好'] })
    matchReasons: string[];

    @ApiProperty({ description: '当前在招岗位数量', example: 2 })
    activeJobsCount: number;

    @ApiProperty({ description: '封面图', required: false })
    imageUrl?: string;
}