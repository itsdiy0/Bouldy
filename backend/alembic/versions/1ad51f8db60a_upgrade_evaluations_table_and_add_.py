"""upgrade evaluations table and add evaluation_results

Revision ID: 1ad51f8db60a
Revises: 4510b53aaa85
Create Date: 2026-02-28 02:53:50.031100

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1ad51f8db60a'
down_revision: Union[str, None] = '4510b53aaa85'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('evaluation_results',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('evaluation_id', sa.UUID(), nullable=False),
    sa.Column('question_index', sa.Integer(), nullable=False),
    sa.Column('question', sa.Text(), nullable=False),
    sa.Column('ground_truth', sa.Text(), nullable=True),
    sa.Column('generated_answer', sa.Text(), nullable=False),
    sa.Column('retrieved_contexts', sa.Text(), nullable=True),
    sa.Column('faithfulness', sa.Float(), nullable=True),
    sa.Column('answer_relevancy', sa.Float(), nullable=True),
    sa.Column('context_precision', sa.Float(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['evaluation_id'], ['evaluations.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.add_column('evaluations', sa.Column('error_message', sa.Text(), nullable=True))
    op.add_column('evaluations', sa.Column('completed_at', sa.DateTime(), nullable=True))

    # Cast String -> Float with safe handling for non-numeric values like "N/A"
    op.execute("""
        ALTER TABLE evaluations
        ALTER COLUMN faithfulness TYPE DOUBLE PRECISION
        USING CASE WHEN faithfulness ~ '^[0-9.]+$' THEN faithfulness::double precision ELSE NULL END
    """)
    op.execute("""
        ALTER TABLE evaluations
        ALTER COLUMN answer_relevancy TYPE DOUBLE PRECISION
        USING CASE WHEN answer_relevancy ~ '^[0-9.]+$' THEN answer_relevancy::double precision ELSE NULL END
    """)
    op.execute("""
        ALTER TABLE evaluations
        ALTER COLUMN context_precision TYPE DOUBLE PRECISION
        USING CASE WHEN context_precision ~ '^[0-9.]+$' THEN context_precision::double precision ELSE NULL END
    """)

    op.drop_column('evaluations', 'results_json')


def downgrade() -> None:
    op.add_column('evaluations', sa.Column('results_json', sa.TEXT(), autoincrement=False, nullable=True))
    op.alter_column('evaluations', 'context_precision',
               existing_type=sa.Float(),
               type_=sa.VARCHAR(length=10),
               existing_nullable=True)
    op.alter_column('evaluations', 'answer_relevancy',
               existing_type=sa.Float(),
               type_=sa.VARCHAR(length=10),
               existing_nullable=True)
    op.alter_column('evaluations', 'faithfulness',
               existing_type=sa.Float(),
               type_=sa.VARCHAR(length=10),
               existing_nullable=True)
    op.drop_column('evaluations', 'completed_at')
    op.drop_column('evaluations', 'error_message')
    op.drop_table('evaluation_results')