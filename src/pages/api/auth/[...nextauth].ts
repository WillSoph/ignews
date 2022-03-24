import { query as q } from 'faunadb'

import NextAuth from "next-auth"
import Provider from "next-auth/providers"

import { fauna } from '../../../services/fauna'

export default NextAuth({
    // Configure one or more authentication providers
    providers: [
        Provider.GitHub({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            scope: 'read:user'
        }),
        // Provider.Google({
        //     clientId: process.env.GOOGLE_CLIENT_ID,
        //     clientSecret: process.env.GOOGLE_CLIENT_SECRET
        // })
    ],
    callbacks: {
        async session(session) {
            try {
                const userActiveSubcription = await fauna.query(
                    q.Get(
                        q.Intersection([
                            q.Match(
                                q.Index('subscription_by_user_ref'),
                                q.Select(
                                    "ref",
                                    q.Get(
                                        q.Match(
                                            q.Index('user_by_email'),
                                            q.Casefold(session.user.email)
                                        )
                                    )
                                )
                            ),
                            q.Match(
                                q.Index('subscription_by_status'),
                                "active"
                            )
                        ])
                    )
                )

                return {
                    ...session,
                    activeSubscription: userActiveSubcription
                }
            } catch {
                return {
                    ...session,
                    activeSubscription: null
                }
            }
        },
        async signIn(user, account, profile) {
            const { email } = user

            try {
                await fauna.query(
                    q.If(
                        q.Not(
                            q.Exists(
                                q.Match(
                                    q.Index('user_by_email'),
                                    q.Casefold(user.email)
                                )
                            )
                        ),
                        q.Create(
                            q.Collection('users'),
                            { data: { email } }
                        ),
                        q.Get(
                            q.Match(
                                q.Index('user_by_email'),
                                q.Casefold(user.email)
                            )
                        )
                    )
                )
                return true
            } catch {
                return false
            }
        }
    }
})