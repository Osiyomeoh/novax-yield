import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('pool_deployments')
@Index(['poolId'])
@Index(['receivableId'])
@Index(['status'])
export class PoolDeployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  poolId: string; // bytes32 as hex string

  @Column()
  @Index()
  receivableId: string; // bytes32 as hex string

  @Column('decimal', { precision: 20, scale: 6 })
  amount: string; // USDC amount deployed

  @Column({ type: 'timestamp' })
  deployedAt: Date;

  @Column({ default: 'active' })
  @Index()
  status: string; // active, paid, closed

  @Column('decimal', { precision: 20, scale: 6, default: '0' })
  principalReturned: string;

  @Column('decimal', { precision: 20, scale: 6, default: '0' })
  yieldReturned: string;

  @Column({ type: 'timestamp', nullable: true })
  returnedAt: Date;

  @Column({ nullable: true })
  deployTxHash: string;

  @Column({ nullable: true })
  returnTxHash: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

