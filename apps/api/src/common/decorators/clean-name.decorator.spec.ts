import { plainToInstance } from 'class-transformer';
import { CreateStudentDto } from '../../modules/students/dto/create-student.dto';

describe('@CleanName', () => {
  it('trims and collapses spaces in a name without changing its case', () => {
    const dto = plainToInstance(CreateStudentDto, { name: '  avyaan   singha ', admissionNo: 'A1' });
    expect(dto.name).toBe('avyaan singha');
  });
});
